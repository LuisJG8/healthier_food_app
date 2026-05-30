export type ProductSource = "open-food-facts" | "demo";

export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  categories: string[];
  categoriesText?: string;
  ingredientsText?: string;
  ingredientsTags: string[];
  additivesTags: string[];
  allergensTags: string[];
  labelsTags: string[];
  nutriments: Record<string, unknown>;
  novaGroup?: number;
  nutriscoreGrade?: string;
  ecoscoreGrade?: string;
  imageUrl?: string;
  source: ProductSource;
}

export type IngredientFlagSeverity = "high" | "medium" | "low" | "positive" | "info";

export interface IngredientFlag {
  id: string;
  label: string;
  description: string;
  severity: IngredientFlagSeverity;
  impact: number;
  matchedTerms: string[];
}

export interface QualityScore {
  value: number;
  label: string;
  summary: string;
  flags: IngredientFlag[];
  positives: IngredientFlag[];
  confidence: "high" | "medium" | "low";
}

export interface AlternativeProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  reason: string;
  scoreHint: string;
}

export interface ScanHistoryItem {
  barcode: string;
  productName: string;
  brand?: string;
  score: number;
  scannedAt: string;
  imageUrl?: string;
}

export interface AppSettings {
  strictSeedOilPenalty: boolean;
}

export interface OpenFoodFactsApiResponse {
  code?: string | number;
  status?: number;
  status_verbose?: string;
  product?: OpenFoodFactsApiProduct;
}

export interface OpenFoodFactsApiProduct {
  code?: string | number;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  ingredients_text?: string;
  ingredients_text_en?: string;
  ingredients_tags?: string[];
  additives_tags?: string[];
  allergens_tags?: string[];
  labels_tags?: string[];
  nutriments?: Record<string, unknown>;
  nova_group?: number | string;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
  image_front_url?: string;
  image_url?: string;
}
