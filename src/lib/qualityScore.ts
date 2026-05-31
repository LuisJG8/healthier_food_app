import type { IngredientFlag, Product, QualityScore } from "../types";

export interface ScoreOptions {
  strictSeedOilPenalty?: boolean;
}

type Rule = {
  id: string;
  label: string;
  description: string;
  severity: IngredientFlag["severity"];
  impact: number;
  terms: RegExp[];
};

const PENALTY_RULES: Rule[] = [
  {
    id: "seed-oils",
    label: "Industrial seed oils",
    description: "Contains oils better_bite treats as lower-quality ingredients.",
    severity: "high",
    impact: -1.5,
    terms: [
      /\bcanola oil\b/,
      /\brapeseed oil\b/,
      /\bsoybean oil\b/,
      /\bsunflower oil\b/,
      /\bsafflower oil\b/,
      /\bcottonseed oil\b/,
      /\bcorn oil\b/,
      /\bgrapeseed oil\b/,
      /\brice bran oil\b/,
      /\bvegetable oil\b/,
    ],
  },
  {
    id: "artificial-colors",
    label: "Artificial colors",
    description: "Includes synthetic colors that many clean-label shoppers prefer to limit.",
    severity: "high",
    impact: -1.25,
    terms: [
      /\bred\s*40\b/,
      /\byellow\s*5\b/,
      /\byellow\s*6\b/,
      /\bblue\s*1\b/,
      /\bblue\s*2\b/,
      /\bgreen\s*3\b/,
      /\bcaramel colo[u]?r\b/,
      /\bartificial colo[u]?rs?\b/,
      /\bcolor added\b/,
    ],
  },
  {
    id: "corn-syrup",
    label: "Corn syrup sweeteners",
    description: "Uses corn syrup or high-fructose corn syrup as a sweetener.",
    severity: "high",
    impact: -1.5,
    terms: [/\bhigh fructose corn syrup\b/, /\bhfcs\b/, /\bcorn syrup\b/, /\bglucose-fructose syrup\b/],
  },
  {
    id: "artificial-sweeteners",
    label: "Artificial sweeteners",
    description: "Contains non-sugar sweeteners some users may want to avoid.",
    severity: "medium",
    impact: -1,
    terms: [/\baspartame\b/, /\bsucralose\b/, /\bsaccharin\b/, /\bacesulfame\b/, /\bacesulfame potassium\b/, /\bneotame\b/],
  },
  {
    id: "preservatives",
    label: "Preservatives",
    description: "Contains preservatives often associated with highly processed packaged foods.",
    severity: "medium",
    impact: -1,
    terms: [
      /\bsodium benzoate\b/,
      /\bpotassium sorbate\b/,
      /\bcalcium propionate\b/,
      /\btbhq\b/,
      /\bbht\b/,
      /\bbha\b/,
      /\bsodium nitrate\b/,
      /\bsodium nitrite\b/,
    ],
  },
  {
    id: "emulsifiers",
    label: "Emulsifiers and stabilizers",
    description: "Includes texture additives common in more processed foods.",
    severity: "low",
    impact: -0.75,
    terms: [
      /\bpolysorbate\b/,
      /\bmono[- ]? and diglycerides\b/,
      /\bmonoglycerides\b/,
      /\bdiglycerides\b/,
      /\bcarrageenan\b/,
      /\bxanthan gum\b/,
      /\bguar gum\b/,
      /\bcellulose gum\b/,
    ],
  },
  {
    id: "added-sugar",
    label: "Added sugars",
    description: "Contains added sweeteners that lower the ingredient-quality score.",
    severity: "medium",
    impact: -0.75,
    terms: [
      /\bcane sugar\b/,
      /\bsugar\b/,
      /\bdextrose\b/,
      /\bfructose\b/,
      /\bmaltodextrin\b/,
      /\binvert sugar\b/,
      /\bbrown rice syrup\b/,
      /\bmolasses\b/,
      /\bagave\b/,
    ],
  },
];

const POSITIVE_RULES: Rule[] = [
  {
    id: "organic",
    label: "Organic label",
    description: "Product is labeled organic.",
    severity: "positive",
    impact: 0.5,
    terms: [/\borganic\b/],
  },
  {
    id: "non-gmo",
    label: "Non-GMO label",
    description: "Product is labeled non-GMO.",
    severity: "positive",
    impact: 0.3,
    terms: [/\bnon[- ]?gmo\b/, /\bno genetically modified\b/],
  },
];

export function scoreProduct(product: Product, options: ScoreOptions = {}): QualityScore {
  const strictSeedOilPenalty = options.strictSeedOilPenalty ?? true;
  const ingredientCount = countIngredients(product.ingredientsText);
  const hasIngredientData = Boolean(product.ingredientsText?.trim()) || product.ingredientsTags.length > 0;

  if (!hasIngredientData) {
    return {
      value: 5,
      label: "Needs review",
      summary: "Ingredient data is missing, so better_bite uses a neutral score until more details are available.",
      flags: [
        {
          id: "missing-ingredients",
          label: "Limited ingredient data",
          description: "This product needs an ingredient list before it can be scored confidently.",
          severity: "info",
          impact: 0,
          matchedTerms: [],
        },
      ],
      positives: [],
      confidence: "low",
    };
  }

  let score = 10;
  const flags: IngredientFlag[] = [];
  const positives: IngredientFlag[] = [];
  const penaltySearchText = buildPenaltySearchText(product);
  const positiveSearchText = buildPositiveSearchText(product);
  const categorySearchText = buildCategorySearchText(product);

  for (const rule of PENALTY_RULES) {
    const matchedTerms = matchRule(rule, penaltySearchText);
    if (matchedTerms.length > 0) {
      const impact = rule.id === "seed-oils" && !strictSeedOilPenalty ? -0.75 : rule.impact;
      flags.push({ ...toFlag(rule, matchedTerms, impact) });
      score += impact;
    }
  }

  const additiveFlag = scoreAdditives(product.additivesTags.length);
  if (additiveFlag) {
    flags.push(additiveFlag);
    score += additiveFlag.impact;
  }

  const sugaryDrinkFlag = scoreSugaryDrink(categorySearchText, flags);
  if (sugaryDrinkFlag) {
    flags.push(sugaryDrinkFlag);
    score += sugaryDrinkFlag.impact;
  }

  const sugarDensityFlag = scoreSugarDensity(product, flags);
  if (sugarDensityFlag) {
    flags.push(sugarDensityFlag);
    score += sugarDensityFlag.impact;
  }

  const ingredientLengthFlag = scoreIngredientLength(ingredientCount);
  if (ingredientLengthFlag) {
    flags.push(ingredientLengthFlag);
    score += ingredientLengthFlag.impact;
  }

  const processingFlag = scoreProcessingLevel(product.novaGroup);
  if (processingFlag) {
    flags.push(processingFlag);
    score += processingFlag.impact;
  }

  for (const rule of POSITIVE_RULES) {
    const matchedTerms = matchRule(rule, positiveSearchText);
    if (matchedTerms.length > 0) {
      positives.push({ ...toFlag(rule, matchedTerms) });
      score += rule.impact;
    }
  }

  const shortListBonus = scoreShortIngredientList(ingredientCount);
  if (shortListBonus) {
    positives.push(shortListBonus);
    score += shortListBonus.impact;
  }

  if (product.novaGroup && product.novaGroup <= 2) {
    const impact = product.novaGroup === 1 ? 1 : 0.4;
    positives.push({
      id: "minimal-processing",
      label: "Lower processing level",
      description: "The processing level appears lower than many packaged foods.",
      severity: "positive",
      impact,
      matchedTerms: [`NOVA ${product.novaGroup}`],
    });
    score += impact;
  }

  const value = clampAndRound(score);
  return {
    value,
    label: scoreLabel(value),
    summary: scoreSummary(value, flags),
    flags,
    positives,
    confidence: confidenceFor(product, ingredientCount),
  };
}

export function countIngredients(ingredientsText?: string): number {
  if (!ingredientsText?.trim()) {
    return 0;
  }

  return ingredientsText
    .split(/[,;()]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function buildPenaltySearchText(product: Product): string {
  return cleanSearchText([product.ingredientsText, product.ingredientsTags.join(" "), product.additivesTags.join(" ")]);
}

function buildPositiveSearchText(product: Product): string {
  return cleanSearchText([
    product.name,
    product.brand,
    product.categoriesText,
    product.ingredientsText,
    product.ingredientsTags.join(" "),
    product.labelsTags.join(" "),
  ]);
}

function buildCategorySearchText(product: Product): string {
  return cleanSearchText([product.name, product.categoriesText, product.categories.join(" ")]);
}

function cleanSearchText(values: Array<string | undefined>): string {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/en:/g, "")
    .replace(/-/g, " ");
}

function matchRule(rule: Rule, searchText: string): string[] {
  return rule.terms
    .filter((term) => term.test(searchText))
    .map((term) => term.source.replace(/\\b/g, "").replace(/\\/g, ""));
}

function toFlag(rule: Rule, matchedTerms: string[], impact = rule.impact): IngredientFlag {
  return {
    id: rule.id,
    label: rule.label,
    description: rule.description,
    severity: rule.severity,
    impact,
    matchedTerms,
  };
}

function scoreAdditives(additiveCount: number): IngredientFlag | null {
  if (additiveCount >= 5) {
    return {
      id: "many-additives",
      label: "Many additives",
      description: "The product lists several additives, which suggests heavier processing.",
      severity: "medium",
      impact: -1.5,
      matchedTerms: [`${additiveCount} additives`],
    };
  }

  if (additiveCount >= 2) {
    return {
      id: "some-additives",
      label: "Some additives",
      description: "The product includes multiple additives.",
      severity: "low",
      impact: -0.75,
      matchedTerms: [`${additiveCount} additives`],
    };
  }

  return null;
}

function scoreSugaryDrink(categorySearchText: string, flags: IngredientFlag[]): IngredientFlag | null {
  const hasAddedSugar = flags.some((flag) => flag.id === "added-sugar" || flag.id === "corn-syrup");
  const isSoda = /\b(soda|colas?|soft drink|carbonated drink|beverages?|drink)\b/.test(categorySearchText);

  if (!hasAddedSugar || !isSoda) {
    return null;
  }

  return {
    id: "sweetened-drink",
    label: "Sweetened drink",
    description: "Sweetened sodas and similar drinks score lower under the strict clean-label policy.",
    severity: "high",
    impact: -2,
    matchedTerms: ["soda", "added sugar"],
  };
}

function scoreSugarDensity(product: Product, flags: IngredientFlag[]): IngredientFlag | null {
  const hasAddedSugar = flags.some((flag) => flag.id === "added-sugar" || flag.id === "corn-syrup");
  const sugarPer100 = readNumericNutriment(product.nutriments, ["sugars_100g", "sugars"]);

  if (!hasAddedSugar || sugarPer100 === undefined || sugarPer100 < 10) {
    return null;
  }

  const impact = sugarPer100 >= 30 ? -1.5 : -0.75;

  return {
    id: "high-added-sugar",
    label: "High added-sugar signal",
    description: "Nutrition data shows a higher sugar level alongside added sweeteners.",
    severity: sugarPer100 >= 30 ? "high" : "medium",
    impact,
    matchedTerms: [`${sugarPer100}g sugar per 100g/ml`],
  };
}

function scoreIngredientLength(ingredientCount: number): IngredientFlag | null {
  if (ingredientCount > 20) {
    return {
      id: "very-long-list",
      label: "Very long ingredient list",
      description: "Long ingredient lists often indicate more processing.",
      severity: "medium",
      impact: -1.25,
      matchedTerms: [`${ingredientCount} ingredients`],
    };
  }

  if (ingredientCount > 12) {
    return {
      id: "long-list",
      label: "Long ingredient list",
      description: "This has more ingredients than better_bite expects for a clean-label staple.",
      severity: "low",
      impact: -0.75,
      matchedTerms: [`${ingredientCount} ingredients`],
    };
  }

  return null;
}

function scoreProcessingLevel(novaGroup?: number): IngredientFlag | null {
  if (novaGroup === 4) {
    return {
      id: "ultra-processed",
      label: "Ultra-processed",
      description: "Open Food Facts classifies this as NOVA 4, the highest processing group.",
      severity: "high",
      impact: -2,
      matchedTerms: ["NOVA 4"],
    };
  }

  if (novaGroup === 3) {
    return {
      id: "processed",
      label: "Processed food",
      description: "Open Food Facts classifies this as NOVA 3.",
      severity: "low",
      impact: -0.75,
      matchedTerms: ["NOVA 3"],
    };
  }

  return null;
}

function scoreShortIngredientList(ingredientCount: number): IngredientFlag | null {
  if (ingredientCount > 0 && ingredientCount <= 3) {
    return {
      id: "short-list",
      label: "Short ingredient list",
      description: "A shorter ingredient list is easier to evaluate.",
      severity: "positive",
      impact: 1,
      matchedTerms: [`${ingredientCount} ingredients`],
    };
  }

  if (ingredientCount > 0 && ingredientCount <= 7) {
    return {
      id: "simple-list",
      label: "Simple ingredient list",
      description: "The ingredient list is relatively simple for a packaged food.",
      severity: "positive",
      impact: 0.5,
      matchedTerms: [`${ingredientCount} ingredients`],
    };
  }

  return null;
}

function readNumericNutriment(nutriments: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = nutriments[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function clampAndRound(score: number): number {
  return Math.round(Math.min(10, Math.max(1, score)));
}

function scoreLabel(value: number): string {
  if (value >= 9) return "Excellent";
  if (value >= 7) return "Clean pick";
  if (value >= 5) return "Mixed";
  if (value >= 3) return "Limit";
  return "Low quality";
}

function scoreSummary(value: number, flags: IngredientFlag[]): string {
  if (value >= 8) {
    return "This product has a cleaner ingredient profile than most packaged options.";
  }

  if (flags.length === 0) {
    return "This product looks acceptable, but better_bite found limited reasons to raise or lower the score.";
  }

  const topFlags = flags
    .slice(0, 2)
    .map((flag) => flag.label.toLowerCase())
    .join(" and ");
  return `Score lowered because better_bite found ${topFlags}.`;
}

function confidenceFor(product: Product, ingredientCount: number): QualityScore["confidence"] {
  if (ingredientCount === 0) return "low";
  if (product.additivesTags.length > 0 || product.novaGroup) return "high";
  return "medium";
}
