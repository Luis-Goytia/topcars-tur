import OpenAI from "openai";
import { ExternalReview, MatchedReview, Product } from "../../models/types";
import { LLMClient } from "./llmClient";
import { callWithRetry } from "./retry";
import { runWithLlmConcurrency } from "./concurrencyPool";

interface RawMatch {
  review_id: string;
  confidence?: number;
}

interface RawResponse {
  matches: RawMatch[];
}

function buildPrompt(product: Product, dealerOfficialName: string | undefined, reviews: ExternalReview[]): string {
  const productBlock = JSON.stringify(
    {
      product_id: product.product_id,
      dealer_id: product.dealer_id,
      brand: product.brand,
      model: product.model,
      description: product.description,
      dealer_official_name: dealerOfficialName,
    },
    null,
    2,
  );

  const reviewsBlock = JSON.stringify(
    reviews.map((r) => ({
      review_id: r.review_id,
      external_dealer_name: r.external_dealer_name,
      text: r.text,
      rating: r.rating,
    })),
    null,
    2,
  );

  return [
    "You are an assistant that links dealership reviews to a specific internal car product.",
    "You will receive the product details and a list of candidate reviews from (approximately) the same dealer.",
    "",
    "Use ALL the available information (brand, model, description, dealer name and review text).",
    "Treat small variations or typos in model names as the same model.",
    'Examples: "Corola" ≈ "Corolla", "Corolla" can match "Corolla Cross" if it clearly refers to the same brand and type of vehicle.',
    'Also consider variants like "F150" vs "F-150", "RAV4" vs "RAV 4", etc.',
    'If the product description mentions a distinctive feature (e.g. "pick-up roja, ideal para trabajo pesado") and a review from the same dealer clearly refers to "mi camioneta roja" for heavy work, treat that as a strong indication it is the same product.',
    "",
    "You are matching REVIEWS ABOUT THE CAR ITSELF, not general opinions about the dealership.",
    "Do NOT match reviews that only talk about prices, financing, discounts, waiting times for paperwork/plates, or general service quality, unless they clearly mention this specific car model.",
    "",
    "Return a STRICT JSON with the following shape and nothing else:",
    '{ "matches": [ { "review_id": "string", "confidence": number } ] }',
    "",
    "Rules:",
    "- Only include in matches the reviews that clearly correspond to the given product (the specific car model).",
    "- Do NOT include purely dealership-wide reviews, e.g. only about \"prices\", \"good service\", \"they took long to deliver plates\", etc., if they don't clearly reference this car model.",
    "- confidence must be between 0 and 1.",
    "- Use confidence >= 0.9 when the match is very clear (same model or obvious variant).",
    "- Use confidence around 0.6–0.8 only when the review still clearly talks about this car model but with some ambiguity.",
    "- If a review clearly talks about another model (e.g. different brand/model), do NOT include it.",
    "",
    "PRODUCT:",
    productBlock,
    "",
    "CANDIDATE_REVIEWS:",
    reviewsBlock,
  ].join("\n");
}

export class OpenAiLlmClient implements LLMClient {
  private client: OpenAI;

  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY no está definido en el entorno");
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.LLM_MODEL || "gpt-4.1-mini";
  }

  async matchReviewsWithProduct(input: {
    product: Product;
    dealerOfficialName?: string;
    externalReviews: ExternalReview[];
  }): Promise<MatchedReview[]> {
    const { product, dealerOfficialName, externalReviews } = input;

    if (externalReviews.length === 0) return [];

    // Detailed logs to understand how the LLM is invoked
    // (without including full review text to avoid flooding the terminal)
    // eslint-disable-next-line no-console
    console.log("[LLM] Preparando llamada", {
      productId: product.product_id,
      dealerId: product.dealer_id,
      brand: product.brand,
      modelName: product.model,
      dealerOfficialName,
      candidateReviews: externalReviews.length,
      llmModel: this.model,
    });

    const prompt = buildPrompt(product, dealerOfficialName, externalReviews);

    const raw = await runWithLlmConcurrency(() =>
      callWithRetry(async () => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          // JSON mode: fuerza al modelo a devolver JSON válido
          response_format: { type: "json_object" },
        });

        const text = response.choices[0]?.message?.content ?? "";
        if (!text) {
          throw new Error("Respuesta del LLM vacía");
        }

        let parsed: RawResponse;
        try {
          parsed = JSON.parse(text);
        } catch (err) {
          throw new Error(`No se pudo parsear JSON del LLM: ${(err as Error).message}`);
        }
        return parsed;
      }),
    );

    // eslint-disable-next-line no-console
    console.log("[LLM] Respuesta cruda del modelo", {
      productId: product.product_id,
      matchesEnRespuesta: raw.matches?.length ?? 0,
    });

    const matchById = new Map<string, RawMatch>();
    for (const m of raw.matches || []) {
      matchById.set(m.review_id, m);
    }

    const matched: MatchedReview[] = [];
    for (const review of externalReviews) {
      const m = matchById.get(review.review_id);
      if (!m) continue;
      const confidence = m.confidence ?? 1;
      // Only keep matches with confidence >= 0.7 (70%)
      if (confidence < 0.7) continue;
      matched.push({
        ...review,
        confidence,
      });
    }

    // eslint-disable-next-line no-console
    console.log("[LLM] Matches filtrados por umbral de confianza", {
      productId: product.product_id,
      totalFiltrados: matched.length,
      detalle: matched.map((r) => ({
        review_id: r.review_id,
        external_dealer_name: r.external_dealer_name,
        rating: r.rating,
        confidence: r.confidence,
      })),
    });

    return matched;
  }
}

