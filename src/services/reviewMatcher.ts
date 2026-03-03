import { getAllDealers, getAllExternalReviews, findDealerById, findProductById, saveExternalReviews } from "../data/jsonReaders";
import { getReviewsByProductId, saveReviewsForProduct } from "../data/reviewStorage";
import { ExternalReview, MatchedReview, Product, SyncSummary } from "../models/types";
import { OpenAiLlmClient } from "./llm/openAiLlmClient";

const DEFAULT_BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE) || 20;

function normalize(str: string | undefined | null): string {
  if (str == null || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prefilterReviews(product: Product): ExternalReview[] {
  const dealers = getAllDealers();
  const external = getAllExternalReviews();

  const dealer = findDealerById(product.dealer_id);
  if (!dealer) {
    return external;
  }

  const dealerNorm = normalize(dealer.official_name);
  const dealerTokens = dealerNorm.split(" ").filter(Boolean);

  return external.filter((r) => {
    const nameNorm = normalize(r.external_dealer_name);
    const nameTokens = nameNorm.split(" ").filter(Boolean);

    // Match any relevant dealer token in the external dealer name
    if (
      dealerTokens.some((t) => t.length >= 3 && nameNorm.includes(t))
    ) {
      return true;
    }

    // Or the other way around: tokens from the external name present in the official dealer name
    if (
      nameTokens.some((t) => t.length >= 3 && dealerNorm.includes(t))
    ) {
      return true;
    }

    return false;
  });
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const llmClient = new OpenAiLlmClient();

export async function syncReviewsForProduct(productId: string): Promise<{
  product: Product;
  newReviews: MatchedReview[];
  allReviews: MatchedReview[];
  summary: SyncSummary;
}> {
  const product = findProductById(productId);
  if (!product) {
    const error: any = new Error(`Producto ${productId} no encontrado`);
    error.status = 404;
    throw error;
  }

  const dealer = findDealerById(product.dealer_id);
  const dealerName = dealer?.official_name;

  const candidates = prefilterReviews(product);

  // eslint-disable-next-line no-console
  console.log("[LLM] Candidates after pre-filter", {
    productId,
    brand: product.brand,
    model: product.model,
    dealerId: product.dealer_id,
    dealerName,
    totalCandidates: candidates.length,
  });

  const batches = chunkArray(candidates, DEFAULT_BATCH_SIZE);

  // eslint-disable-next-line no-console
  console.log("[LLM] Processing batches", {
    productId,
    totalBatches: batches.length,
    batchSize: DEFAULT_BATCH_SIZE,
  });

  const results = await Promise.all(
    batches.map(async (batch, index) => {
      // eslint-disable-next-line no-console
      console.log("[LLM] Batch", {
        productId,
        index: index + 1,
        batchSize: batch.length,
      });
      return llmClient.matchReviewsWithProduct(
        dealerName
          ? {
              product,
              dealerOfficialName: dealerName,
              externalReviews: batch,
            }
          : {
              product,
              externalReviews: batch,
            },
      );
    }),
  );

  const flatMatched = results.flat();

  const dedupMap = new Map<string, MatchedReview>();
  for (const r of flatMatched) {
    const existing = dedupMap.get(r.review_id);
    if (!existing || (r.confidence ?? 0) > (existing.confidence ?? 0)) {
      dedupMap.set(r.review_id, r);
    }
  }
  const matchedUnique = Array.from(dedupMap.values());

  const existing = getReviewsByProductId(productId);
  const existingIds = new Set(existing.map((r) => r.review_id));

  const newReviews = matchedUnique.filter((r) => !existingIds.has(r.review_id));
  const allReviews = [...existing, ...newReviews];

  const association = saveReviewsForProduct(productId, allReviews);

  const summary: SyncSummary = {
    productId,
    totalMatched: allReviews.length,
    newMatched: newReviews.length,
    previouslyMatched: existing.length,
    syncedAt: association.lastSyncedAt,
  };

  // Remove from external_reviews those reviews that are now associated
  if (matchedUnique.length > 0) {
    const usedIds = new Set(matchedUnique.map((r) => r.review_id));
    const currentExternal = getAllExternalReviews();
    const remainingExternal = currentExternal.filter((r) => !usedIds.has(r.review_id));
    if (remainingExternal.length !== currentExternal.length) {
      saveExternalReviews(remainingExternal);
    }
  }

  // eslint-disable-next-line no-console
  console.log("[LLM] Sync summary", {
    productId,
    totalMatched: summary.totalMatched,
    newMatched: summary.newMatched,
    previouslyMatched: summary.previouslyMatched,
    syncedAt: summary.syncedAt,
  });

  return {
    product,
    newReviews,
    allReviews,
    summary,
  };
}

