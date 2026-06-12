import { describe, expect, it } from "vitest";
import {
  INITIAL_FOOD_SEARCH_STATE,
  friendlyTypesenseError,
  mapTypesenseFoodDocument,
  reduceFoodSearchState,
  type FoodSearchResult,
} from "./typesenseSearch";

const result: FoodSearchResult = {
  id: "food-001",
  name: "Avocado Oil Sea Salt Chips",
  brand: "Boulder Canyon",
  category: "Potato chips",
  cravingTags: ["salty", "crunchy", "potato"],
  formatTags: ["chips", "bagged snack"],
  healthTags: ["cleaner oil"],
  ingredientsSummary: "potatoes, avocado oil, sea salt",
  betterbiteScore: 9,
  textMatch: 100,
};

describe("typesense food search helpers", () => {
  it("maps a valid Typesense food document into a safe result shape", () => {
    expect(
      mapTypesenseFoodDocument({
        id: " food-001 ",
        name: " Avocado Oil Sea Salt Chips ",
        brand: " Boulder Canyon ",
        category: "Potato chips",
        cravingTags: ["salty", "crunchy", "salty"],
        formatTags: ["chips"],
        healthTags: ["cleaner oil"],
        ingredientsSummary: "potatoes, avocado oil, sea salt",
        betterbiteScore: 9.2,
        imageUrl: "https://example.com/chips.jpg",
      }),
    ).toEqual({
      id: "food-001",
      name: "Avocado Oil Sea Salt Chips",
      brand: "Boulder Canyon",
      category: "Potato chips",
      cravingTags: ["salty", "crunchy"],
      formatTags: ["chips"],
      healthTags: ["cleaner oil"],
      ingredientsSummary: "potatoes, avocado oil, sea salt",
      betterbiteScore: 9,
      imageUrl: "https://example.com/chips.jpg",
    });
  });

  it("drops malformed documents that do not have required fields", () => {
    expect(mapTypesenseFoodDocument({ id: "food-001", category: "Chips" })).toBeNull();
    expect(mapTypesenseFoodDocument(null)).toBeNull();
  });

  it("uses safe defaults for missing optional fields", () => {
    expect(
      mapTypesenseFoodDocument({
        id: "food-002",
        name: "Mystery Snack",
        category: "Snacks",
        betterbiteScore: Number.NaN,
        imageUrl: "http://example.com/insecure.jpg",
      }),
    ).toEqual({
      id: "food-002",
      name: "Mystery Snack",
      brand: "Unknown brand",
      category: "Snacks",
      cravingTags: [],
      formatTags: [],
      healthTags: [],
      ingredientsSummary: "Ingredient summary is not available for this prototype food.",
      betterbiteScore: 5,
      imageUrl: undefined,
    });
  });

  it("moves through empty, loading, success, no result, and error states", () => {
    const withQuery = reduceFoodSearchState(INITIAL_FOOD_SEARCH_STATE, { type: "queryChanged", query: "chips" });
    expect(withQuery).toMatchObject({ query: "chips", status: "idle" });

    const loading = reduceFoodSearchState(withQuery, { type: "searchStarted", query: "chips" });
    expect(loading).toMatchObject({ submittedQuery: "chips", status: "loading", results: [] });

    const success = reduceFoodSearchState(loading, { type: "searchSucceeded", query: "chips", results: [result] });
    expect(success.status).toBe("success");
    expect(success.selectedResult).toEqual(result);

    const empty = reduceFoodSearchState(loading, { type: "searchSucceeded", query: "chips", results: [] });
    expect(empty).toMatchObject({ status: "empty", selectedResult: null });

    const error = reduceFoodSearchState(loading, { type: "searchFailed", query: "chips", error: "offline" });
    expect(error).toMatchObject({ status: "error", error: "offline", selectedResult: null });

    const reset = reduceFoodSearchState(error, { type: "queryChanged", query: " " });
    expect(reset).toMatchObject({ query: " ", status: "idle", results: [], selectedResult: null });
  });

  it("ignores stale search completions after the query changes", () => {
    const withQuery = reduceFoodSearchState(INITIAL_FOOD_SEARCH_STATE, { type: "queryChanged", query: "chips" });
    const loading = reduceFoodSearchState(withQuery, { type: "searchStarted", query: "chips" });
    const changed = reduceFoodSearchState(loading, { type: "queryChanged", query: "soda" });

    expect(changed).toMatchObject({ query: "soda", submittedQuery: "", status: "idle", results: [], selectedResult: null });
    expect(reduceFoodSearchState(changed, { type: "searchSucceeded", query: "chips", results: [result] })).toBe(changed);
    expect(reduceFoodSearchState(changed, { type: "searchFailed", query: "chips", error: "offline" })).toBe(changed);
  });

  it("turns common Typesense failures into actionable messages", () => {
    expect(friendlyTypesenseError(new Error("Failed to fetch"))).toContain("docker compose up");
    expect(friendlyTypesenseError(new Error("401 Unauthorized"))).toContain("pnpm typesense:seed");
  });
});
