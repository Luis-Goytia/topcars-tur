import express from "express";
import { getAllDealers, getAllExternalReviews, getAllProducts, saveExternalReviews } from "../data/jsonReaders";
import { getAllAssociations, getReviewsByProductId } from "../data/reviewStorage";
import { syncReviewsForProduct } from "../services/reviewMatcher";

const router = express.Router();

router.get("/", (_req, res) => {
  const products = getAllProducts();
  const dealers = getAllDealers();
  const dealerById = new Map(dealers.map((d) => [d.dealer_id, d]));

  const enriched = products.map((p) => ({
    ...p,
    dealer_name: dealerById.get(p.dealer_id)?.official_name ?? p.dealer_id,
  }));

  res.json(enriched);
});

router.post("/reviews/sync-all", async (_req, res, next) => {
  const products = getAllProducts();
  const startedAt = Date.now();

  const summaries: any[] = [];
  const errors: { productId: string; error: string }[] = [];

  await Promise.all(
    products.map(async (p) => {
      try {
        const result = await syncReviewsForProduct(p.product_id);
        summaries.push(result.summary);
      } catch (err: any) {
        errors.push({ productId: p.product_id, error: err?.message ?? "Unknown error" });
      }
    }),
  );

  const durationMs = Date.now() - startedAt;

  res.json({
    durationMs,
    totalProducts: products.length,
    processedProducts: summaries.length,
    summaries,
    errors,
  });
});

router.post("/reviews/prune-external", (_req, res) => {
  const associations = getAllAssociations();
  const usedReviewIds = new Set<string>();
  for (const assoc of associations) {
    for (const r of assoc.reviews) {
      usedReviewIds.add(r.review_id);
    }
  }

  const allExternal = getAllExternalReviews();
  const remaining = allExternal.filter((r) => !usedReviewIds.has(r.review_id));

  saveExternalReviews(remaining);

  res.json({
    removed: allExternal.length - remaining.length,
    remaining: remaining.length,
    totalAssociations: associations.length,
  });
});

router.get("/:productId/reviews", (req, res, next) => {
  const { productId } = req.params;
  try {
    const reviews = getReviewsByProductId(productId);
    res.json({ productId, reviews });
  } catch (err) {
    next(err);
  }
});

router.post("/:productId/reviews/sync", async (req, res, next) => {
  const { productId } = req.params;
  try {
    const result = await syncReviewsForProduct(productId);
    res.json(result);
  } catch (err: any) {
    if (err?.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err?.status === 429) {
      return res.status(502).json({ error: "Rate limit del proveedor LLM, intenta nuevamente más tarde." });
    }
    next(err);
  }
});

export default router;

