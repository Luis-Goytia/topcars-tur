export interface Product {
  product_id: string;
  dealer_id: string;
  brand: string;
  model: string;
  description: string;
}

export interface Dealer {
  dealer_id: string;
  official_name: string;
  region: string;
}

export interface ExternalReview {
  review_id: string;
  external_dealer_name: string;
  text: string;
  rating?: number;
}

export interface MatchedReview extends ExternalReview {
  confidence?: number;
}

export interface ProductReviewAssociation {
  productId: string;
  reviews: MatchedReview[];
  lastSyncedAt: string;
}

export interface SyncSummary {
  productId: string;
  totalMatched: number;
  newMatched: number;
  previouslyMatched: number;
  syncedAt: string;
}

