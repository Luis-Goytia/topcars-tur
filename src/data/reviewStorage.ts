import fs from "node:fs";
import path from "node:path";
import { MatchedReview, ProductReviewAssociation } from "../models/types";

type StorageShape = Record<string, ProductReviewAssociation>;

const STORAGE_FILE_RELATIVE = "db/product_reviews.json";

let inMemoryStorage: StorageShape = {};
let loadedFromDisk = false;

function getStorageFilePath() {
  return path.join(process.cwd(), STORAGE_FILE_RELATIVE);
}

function loadFromDiskIfExists() {
  if (loadedFromDisk) return;
  loadedFromDisk = true;
  const filePath = getStorageFilePath();
  if (!fs.existsSync(filePath)) {
    inMemoryStorage = {};
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    inMemoryStorage = JSON.parse(raw) as StorageShape;
  } catch {
    inMemoryStorage = {};
  }
}

function persistToDisk() {
  const filePath = getStorageFilePath();
  fs.writeFileSync(filePath, JSON.stringify(inMemoryStorage, null, 2), "utf8");
}

export function getReviewsByProductId(productId: string): MatchedReview[] {
  loadFromDiskIfExists();
  const entry = inMemoryStorage[productId];
  return entry ? entry.reviews : [];
}

export function saveReviewsForProduct(productId: string, reviews: MatchedReview[]): ProductReviewAssociation {
  loadFromDiskIfExists();
  const association: ProductReviewAssociation = {
    productId,
    reviews,
    lastSyncedAt: new Date().toISOString(),
  };
  inMemoryStorage[productId] = association;
  persistToDisk();
  return association;
}

export function getAllAssociations(): ProductReviewAssociation[] {
  loadFromDiskIfExists();
  return Object.values(inMemoryStorage);
}

