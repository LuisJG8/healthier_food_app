import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import { classifyProduct, getAlternatives } from "./alternatives";

describe("structured alternative taxonomy", () => {
  it("classifies Kodiak-style pancake mix as pancake mix", () => {
    const product = testProduct({
      name: "Kodiak Power Cakes Flapjack & Waffle Mix",
      brand: "Kodiak",
      categoriesText: "Pancake mixes, Waffle mixes, Breakfast mixes",
      ingredientsText: "Whole grain wheat flour, whole grain oat flour, wheat protein isolate, brown sugar, leavening",
    });

    expect(classifyProduct(product)).toEqual({ type: "pancake_mix", confidence: "high" });
  });

  it("recommends same-format pancake mixes instead of generic fruit", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Kodiak Power Cakes Protein Pancake Mix",
        categoriesText: "Breakfast foods, Pancake mix",
      }),
    );

    expect(alternatives[0]).toMatchObject({
      category: "Pancake mix",
      name: expect.stringMatching(/pancake|waffle/i),
    });
    expect(alternatives.map((alternative) => alternative.name)).not.toContain("Fresh fruit");
  });

  it("keeps protein bars in the bar format", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Chocolate Peanut Butter Protein Bar",
        categoriesText: "Protein bars, Snacks",
      }),
    );

    expect(alternatives[0].category).toBe("Protein bar");
    expect(alternatives[0].name).toMatch(/protein/i);
  });

  it("keeps a bad tortilla chip scan in the salty chip lane", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Nacho Cheese Tortilla Chips",
        categoriesText: "Tortilla chips, Corn chips, Salty snacks",
        ingredientsText: "Corn, vegetable oil, maltodextrin, artificial color red 40, yellow 6, natural flavors",
      }),
    );

    expect(alternatives[0]).toMatchObject({
      category: "Tortilla chips",
      brand: "Siete",
    });
    expect(alternatives.map((alternative) => alternative.category)).not.toContain("Fruit");
  });

  it("keeps a sugary soda scan in the cold bubbly drink lane", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Classic Cola Soda",
        categoriesText: "Sodas, Carbonated drinks",
        ingredientsText: "Carbonated water, high fructose corn syrup, caramel color, phosphoric acid, natural flavors",
      }),
    );

    expect(alternatives[0]).toMatchObject({
      category: "Soda",
      name: "Sparkling water",
    });
    expect(alternatives.map((alternative) => alternative.name)).toContain("Vintage Cola");
  });

  it("keeps cookies as cleaner sweet snacks instead of savory protein swaps", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Chocolate Sandwich Cookies",
        categoriesText: "Cookies, Sweet snacks",
        ingredientsText: "Wheat flour, sugar, palm oil, cocoa, high fructose corn syrup, artificial flavor",
      }),
    );

    expect(alternatives[0]).toMatchObject({
      category: "Cookies",
      brand: "Simple Mills",
    });
    expect(alternatives.map((alternative) => alternative.category)).not.toContain("Jerky");
  });
});

function testProduct(overrides: Partial<Product>): Product {
  return {
    barcode: "123456789012",
    name: "Test product",
    categories: [],
    ingredientsTags: [],
    additivesTags: [],
    allergensTags: [],
    labelsTags: [],
    nutriments: {},
    source: "open-food-facts",
    ...overrides,
  };
}
