import fs from "node:fs";
import path from "node:path";
import { Dealer, ExternalReview, Product } from "../models/types";

function readJsonFile<T>(relativePath: string): T {
  const fullPath = path.join(process.cwd(), relativePath);
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

function writeJsonFile<T>(relativePath: string, data: T): void {
  const fullPath = path.join(process.cwd(), relativePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
}

let cachedProducts: Product[] | null = null;
let cachedDealers: Dealer[] | null = null;
let cachedExternalReviews: ExternalReview[] | null = null;

export function getAllProducts(): Product[] {
  if (!cachedProducts) {
    cachedProducts = readJsonFile<Product[]>("db/internal_products.json");
  }
  return cachedProducts;
}

export function getAllDealers(): Dealer[] {
  if (!cachedDealers) {
    cachedDealers = readJsonFile<Dealer[]>("db/internal_dealers.json");
  }
  return cachedDealers;
}

export function getAllExternalReviews(): ExternalReview[] {
  if (!cachedExternalReviews) {
    cachedExternalReviews = readJsonFile<ExternalReview[]>("db/external_reviews.json");
  }
  return cachedExternalReviews;
}

export function saveExternalReviews(reviews: ExternalReview[]): void {
  cachedExternalReviews = reviews;
  writeJsonFile<ExternalReview[]>("db/external_reviews.json", reviews);
}

export function findProductById(productId: string): Product | undefined {
  return getAllProducts().find((p) => p.product_id === productId);
}

export function findDealerById(dealerId: string): Dealer | undefined {
  return getAllDealers().find((d) => d.dealer_id === dealerId);
}

