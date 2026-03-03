import { MatchedReview, ExternalReview, Product } from "../../models/types";

export interface LLMClient {
  matchReviewsWithProduct(input: {
    product: Product;
    dealerOfficialName?: string;
    externalReviews: ExternalReview[];
  }): Promise<MatchedReview[]>;
}

