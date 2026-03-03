import { getAllProducts, getAllDealers, getAllExternalReviews } from "../data/jsonReaders";

describe("jsonReaders", () => {
  it("loads products from db/internal_products.json", () => {
    const products = getAllProducts();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty("product_id");
    expect(products[0]).toHaveProperty("brand");
    expect(products[0]).toHaveProperty("model");
  });

  it("loads dealers from db/internal_dealers.json", () => {
    const dealers = getAllDealers();
    expect(Array.isArray(dealers)).toBe(true);
    expect(dealers.length).toBeGreaterThan(0);
    expect(dealers[0]).toHaveProperty("dealer_id");
    expect(dealers[0]).toHaveProperty("official_name");
  });

  it("loads external reviews from db/external_reviews.json", () => {
    const reviews = getAllExternalReviews();
    expect(Array.isArray(reviews)).toBe(true);
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0]).toHaveProperty("review_id");
    expect(reviews[0]).toHaveProperty("text");
  });
});

