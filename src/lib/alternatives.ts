import type { AlternativeProduct, Product } from "../types";

const ALTERNATIVES: Record<string, AlternativeProduct[]> = {
  soda: [
    {
      id: "sparkling-water",
      name: "Sparkling water",
      category: "Soda",
      reason: "Carbonated, unsweetened, and usually ingredient-light.",
      scoreHint: "Often 9-10",
    },
    {
      id: "olipop",
      name: "Vintage Cola",
      brand: "Olipop",
      category: "Soda",
      reason: "Lower sugar with added prebiotic fiber.",
      scoreHint: "Often 6-8",
    },
    {
      id: "unsweetened-tea",
      name: "Unsweetened iced tea",
      category: "Soda",
      reason: "Simple ingredient list with no added sweetener.",
      scoreHint: "Often 8-10",
    },
  ],
  chips: [
    {
      id: "siete-chips",
      name: "Sea Salt Tortilla Chips",
      brand: "Siete",
      category: "Chips",
      reason: "Uses avocado oil and a shorter ingredient list.",
      scoreHint: "Often 7-9",
    },
    {
      id: "jacksons",
      name: "Sweet Potato Chips",
      brand: "Jackson's",
      category: "Chips",
      reason: "Simple ingredients and avocado or coconut oil options.",
      scoreHint: "Often 7-9",
    },
    {
      id: "homemade-popcorn",
      name: "Air-popped popcorn",
      category: "Chips",
      reason: "Whole-grain snack with ingredients you control.",
      scoreHint: "Often 8-10",
    },
  ],
  cereal: [
    {
      id: "seven-sundays",
      name: "Muesli",
      brand: "Seven Sundays",
      category: "Cereal",
      reason: "Usually simpler ingredients than brightly colored cereals.",
      scoreHint: "Often 7-9",
    },
    {
      id: "oatmeal",
      name: "Plain rolled oats",
      category: "Cereal",
      reason: "Single-ingredient base with flexible toppings.",
      scoreHint: "Often 9-10",
    },
    {
      id: "sprouted-granola",
      name: "Sprouted grain granola",
      category: "Cereal",
      reason: "Look for short lists and low added sugar.",
      scoreHint: "Often 6-8",
    },
  ],
  cookies: [
    {
      id: "simple-mills",
      name: "Crunchy Cookies",
      brand: "Simple Mills",
      category: "Cookies",
      reason: "Cleaner flour blend and simpler ingredient list.",
      scoreHint: "Often 6-8",
    },
    {
      id: "hu-chocolate",
      name: "Dark Chocolate Gems",
      brand: "Hu",
      category: "Cookies",
      reason: "Shorter ingredient list for a sweet snack.",
      scoreHint: "Often 6-8",
    },
    {
      id: "dates-almond-butter",
      name: "Dates with almond butter",
      category: "Cookies",
      reason: "Whole-food sweet option with minimal ingredients.",
      scoreHint: "Often 8-10",
    },
  ],
  yogurt: [
    {
      id: "plain-greek",
      name: "Plain Greek yogurt",
      category: "Yogurt",
      reason: "High protein and avoids flavored-yogurt added sugars.",
      scoreHint: "Often 8-10",
    },
    {
      id: "siggis-plain",
      name: "Plain Skyr",
      brand: "Siggi's",
      category: "Yogurt",
      reason: "Simple ingredient list and higher protein.",
      scoreHint: "Often 8-10",
    },
    {
      id: "coconut-yogurt",
      name: "Unsweetened coconut yogurt",
      category: "Yogurt",
      reason: "Good dairy-free option when gums and sugar are limited.",
      scoreHint: "Often 6-8",
    },
  ],
  milk: [
    {
      id: "organic-milk",
      name: "Organic whole milk",
      category: "Milk",
      reason: "Simple staple with one main ingredient.",
      scoreHint: "Often 9-10",
    },
    {
      id: "grassfed-milk",
      name: "Grass-fed milk",
      category: "Milk",
      reason: "High-quality dairy option with minimal processing.",
      scoreHint: "Often 9-10",
    },
    {
      id: "almond-milk",
      name: "Unsweetened almond milk",
      category: "Milk",
      reason: "Choose versions with short ingredient lists.",
      scoreHint: "Often 6-8",
    },
  ],
  snacks: [
    {
      id: "fruit",
      name: "Fresh fruit",
      category: "Snack",
      reason: "Whole-food snack with no ingredient-label complexity.",
      scoreHint: "Often 10",
    },
    {
      id: "nuts",
      name: "Dry-roasted nuts",
      category: "Snack",
      reason: "Look for nuts and salt only.",
      scoreHint: "Often 8-10",
    },
    {
      id: "jerky",
      name: "Grass-fed beef stick",
      category: "Snack",
      reason: "Can be a cleaner high-protein snack when sugar and additives are low.",
      scoreHint: "Often 6-8",
    },
  ],
};

const FALLBACK = ALTERNATIVES.snacks;

export function getAlternatives(product: Product): AlternativeProduct[] {
  const haystack = [product.name, product.brand, product.categoriesText, product.categories.join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const category = detectCategory(haystack);
  return ALTERNATIVES[category] ?? FALLBACK;
}

function detectCategory(text: string): string {
  if (/\b(soda|cola|soft drink|pop|carbonated drink)\b/.test(text)) return "soda";
  if (/\b(chip|chips|crisps|tortilla)\b/.test(text)) return "chips";
  if (/\b(cereal|granola|muesli)\b/.test(text)) return "cereal";
  if (/\b(cookie|cookies|biscuit|wafer)\b/.test(text)) return "cookies";
  if (/\b(yogurt|yoghurt|skyr)\b/.test(text)) return "yogurt";
  if (/\b(milk|dairy beverage)\b/.test(text)) return "milk";
  return "snacks";
}
