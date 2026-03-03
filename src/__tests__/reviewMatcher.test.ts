/**
 * Basic tests for syncReviewsForProduct using a mocked LLM client.
 * We only verify that the function returns a structured result and
 * does not hit the real OpenAI API.
 */

import { syncReviewsForProduct } from "../services/reviewMatcher";

jest.mock("../services/llm/openAiLlmClient", () => {
  return {
    OpenAiLlmClient: jest.fn().mockImplementation(() => ({
      // Simulate that the LLM accepts all candidate reviews with high confidence
      matchReviewsWithProduct: async ({ externalReviews }: any) =>
        externalReviews.map((r: any) => ({
          ...r,
          confidence: 0.9,
        })),
    })),
  };
});

describe("syncReviewsForProduct", () => {
  it("returns product and reviews structure for a known product", async () => {
    const result = await syncReviewsForProduct("P-1001");

    expect(result.product.product_id).toBe("P-1001");
    expect(Array.isArray(result.allReviews)).toBe(true);
    expect(result.summary).toHaveProperty("productId", "P-1001");
    expect(result.summary).toHaveProperty("totalMatched");
  });
});

