import type { AlternativeProduct, Product } from "../types";

type ProductType =
  | "pancake_mix"
  | "soda"
  | "potato_chips"
  | "tortilla_chips"
  | "chips"
  | "cereal"
  | "granola"
  | "protein_bar"
  | "snack_bar"
  | "cookies"
  | "crackers"
  | "popcorn"
  | "yogurt"
  | "milk"
  | "fruit"
  | "jerky"
  | "snacks";

interface ProductClassification {
  type: ProductType;
  confidence: "high" | "medium" | "low";
}

interface ProductTypeRule {
  type: ProductType;
  confidence: ProductClassification["confidence"];
  patterns: RegExp[];
}

const ALTERNATIVES: Record<ProductType, AlternativeProduct[]> = {
  pancake_mix: [
    {
      id: "simple-mills-pancake-waffle",
      name: "Almond Flour Pancake & Waffle Mix",
      brand: "Simple Mills",
      category: "Pancake mix",
      reason: "A pancake and waffle mix with a shorter ingredient list and almond-flour base.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the same dry-mix breakfast format as Kodiak-style pancake mix instead of switching to an unrelated snack.",
    },
    {
      id: "birch-benders-protein-pancake",
      name: "Protein Pancake & Waffle Mix",
      brand: "Birch Benders",
      category: "Pancake mix",
      reason: "A similar protein-focused pancake mix format with convenient just-add-water prep.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the high-protein pancake occasion and preparation style while comparing ingredient quality.",
    },
    {
      id: "bobs-red-mill-whole-grain-pancake",
      name: "Whole Grain Pancake & Waffle Mix",
      brand: "Bob's Red Mill",
      category: "Pancake mix",
      reason: "A same-use breakfast mix built around whole-grain flours.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the pancake/waffle mix role with a less snack-like, more directly comparable alternative.",
    },
  ],
  soda: [
    {
      id: "sparkling-water",
      name: "Sparkling water",
      category: "Soda",
      reason: "Carbonated, unsweetened, and usually ingredient-light.",
      scoreHint: "Often 9-10",
      similarityReason: "Keeps the cold, bubbly drinking experience without added sugar or syrupy sweeteners.",
    },
    {
      id: "olipop",
      name: "Vintage Cola",
      brand: "Olipop",
      category: "Soda",
      reason: "Lower sugar with added prebiotic fiber.",
      scoreHint: "Often 6-8",
      similarityReason: "Still feels like a cola, but usually has less sugar than conventional soda.",
    },
    {
      id: "unsweetened-tea",
      name: "Unsweetened iced tea",
      category: "Soda",
      reason: "Simple ingredient list with no added sweetener.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the grab-and-sip drink format while moving to a simpler ingredient profile.",
    },
  ],
  potato_chips: [
    {
      id: "boulder-canyon-avocado-oil",
      name: "Avocado Oil Classic Sea Salt Kettle Chips",
      brand: "Boulder Canyon",
      category: "Potato chips",
      reason: "Potato chips made with avocado oil and a short ingredient list.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the salty potato-chip crunch while improving the oil and ingredient profile.",
    },
    {
      id: "jacksons-potato-chips",
      name: "Kettle Cooked Potato Chips",
      brand: "Jackson's",
      category: "Potato chips",
      reason: "A cleaner potato chip option when the ingredient list stays simple.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the same chip format and salty snack occasion.",
    },
    {
      id: "lesser-evil-potato-puffs",
      name: "Himalayan Gold Potato Puffs",
      brand: "LesserEvil",
      category: "Potato chips",
      reason: "A potato-based crunchy snack with cleaner oil choices in many varieties.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the salty/crunchy potato snack lane without jumping to fruit or salad.",
    },
  ],
  tortilla_chips: [
    {
      id: "siete-chips",
      name: "Sea Salt Tortilla Chips",
      brand: "Siete",
      category: "Tortilla chips",
      reason: "Uses avocado oil and a shorter ingredient list.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the salty tortilla-chip crunch while upgrading the oil and ingredient list.",
    },
    {
      id: "late-july-sea-salt",
      name: "Sea Salt Tortilla Chips",
      brand: "Late July",
      category: "Tortilla chips",
      reason: "A directly comparable tortilla chip option with simpler varieties available.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the same tortilla-chip format and dip/snack use case.",
    },
    {
      id: "food-should-taste-good",
      name: "Multigrain Tortilla Chips",
      brand: "Food Should Taste Good",
      category: "Tortilla chips",
      reason: "A crunchy tortilla-style chip with grain-forward varieties.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the chip format while looking for a better ingredient tradeoff.",
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
      similarityReason: "Keeps the salty tortilla-chip crunch while upgrading the oil and ingredient list.",
    },
    {
      id: "jacksons",
      name: "Sweet Potato Chips",
      brand: "Jackson's",
      category: "Chips",
      reason: "Simple ingredients and avocado or coconut oil options.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the salty, crisp snack experience with a cleaner oil choice.",
    },
    {
      id: "homemade-popcorn",
      name: "Air-popped popcorn",
      category: "Chips",
      reason: "Whole-grain snack with ingredients you control.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the crunchy snack ritual while letting you control oil, salt, and additives.",
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
      similarityReason: "Keeps the bowl-of-cereal breakfast format with a less processed ingredient base.",
    },
    {
      id: "oatmeal",
      name: "Plain rolled oats",
      category: "Cereal",
      reason: "Single-ingredient base with flexible toppings.",
      scoreHint: "Often 9-10",
      similarityReason: "Keeps the breakfast bowl routine while swapping to a simpler grain base.",
    },
    {
      id: "sprouted-granola",
      name: "Sprouted grain granola",
      category: "Cereal",
      reason: "Look for short lists and low added sugar.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the crunchy cereal-style bite while improving ingredient quality.",
    },
  ],
  granola: [
    {
      id: "purely-elizabeth-granola",
      name: "Ancient Grain Granola",
      brand: "Purely Elizabeth",
      category: "Granola",
      reason: "A crunchy granola option with a more ingredient-forward profile.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the crunchy granola breakfast/snack format while comparing sugar and oil quality.",
    },
    {
      id: "seven-sundays-muesli",
      name: "Muesli",
      brand: "Seven Sundays",
      category: "Granola",
      reason: "Usually simpler and less sweet than many packaged granolas.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the oat-based breakfast bowl role with a less processed texture.",
    },
    {
      id: "homemade-granola",
      name: "Simple homemade granola",
      category: "Granola",
      reason: "Lets the user control oil, sweetener, nuts, and serving size.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the same crunchy oat topping role while improving ingredient control.",
    },
  ],
  protein_bar: [
    {
      id: "rxbar",
      name: "Protein Bar",
      brand: "RXBAR",
      category: "Protein bar",
      reason: "A protein bar format with a short ingredient list in many flavors.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the high-protein bar convenience while reducing additive complexity.",
    },
    {
      id: "aloha-protein-bar",
      name: "Organic Plant Based Protein Bar",
      brand: "Aloha",
      category: "Protein bar",
      reason: "A similar protein bar option with organic ingredients in many varieties.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the same grab-and-go protein bar use case.",
    },
    {
      id: "perfect-bar",
      name: "Protein Bar",
      brand: "Perfect Bar",
      category: "Protein bar",
      reason: "A refrigerated protein bar option with a food-like texture.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the dense, sweet protein snack format while offering another ingredient profile.",
    },
  ],
  snack_bar: [
    {
      id: "lara-bar",
      name: "Original Fruit & Nut Bar",
      brand: "Larabar",
      category: "Snack bar",
      reason: "A bar format with a short fruit-and-nut ingredient list.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the sweet snack bar convenience without turning the recommendation into loose fruit.",
    },
    {
      id: "thats-it-bar",
      name: "Fruit Bar",
      brand: "That's it.",
      category: "Snack bar",
      reason: "A packaged bar format with a very short ingredient list.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the portable packaged snack format.",
    },
    {
      id: "kind-simple-crunch",
      name: "Simple Crunch Bar",
      brand: "KIND",
      category: "Snack bar",
      reason: "A crunchy bar option where simpler varieties can be easier to compare.",
      scoreHint: "Often 5-7",
      similarityReason: "Keeps the bar texture and packaged convenience.",
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
      similarityReason: "Keeps the cookie format and sweet crunch with a cleaner ingredient approach.",
    },
    {
      id: "hu-chocolate",
      name: "Dark Chocolate Gems",
      brand: "Hu",
      category: "Cookies",
      reason: "Shorter ingredient list for a sweet snack.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the sweet treat moment while moving toward a shorter ingredient list.",
    },
    {
      id: "dates-almond-butter",
      name: "Dates with almond butter",
      category: "Cookies",
      reason: "Whole-food sweet option with minimal ingredients.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the sweet, rich snack craving while using whole-food ingredients.",
    },
  ],
  crackers: [
    {
      id: "simple-mills-crackers",
      name: "Almond Flour Crackers",
      brand: "Simple Mills",
      category: "Crackers",
      reason: "A cracker format with a cleaner flour blend and shorter ingredient list.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the crunchy cracker snack role while improving ingredient quality.",
    },
    {
      id: "marys-gone-crackers",
      name: "Original Crackers",
      brand: "Mary's Gone Crackers",
      category: "Crackers",
      reason: "A seed-and-grain cracker option with recognizable ingredients.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the cracker format for dipping or snacking.",
    },
    {
      id: "wasa-crispbread",
      name: "Whole Grain Crispbread",
      brand: "Wasa",
      category: "Crackers",
      reason: "A crisp cracker-style option with simple whole-grain ingredients.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the crunchy cracker eating occasion with fewer processing signals.",
    },
  ],
  popcorn: [
    {
      id: "lesser-evil-popcorn",
      name: "Himalayan Pink Salt Popcorn",
      brand: "LesserEvil",
      category: "Popcorn",
      reason: "A directly comparable popcorn option with cleaner oil choices in many varieties.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the salty popped-corn snack experience.",
    },
    {
      id: "skinny-pop-original",
      name: "Original Popcorn",
      brand: "SkinnyPop",
      category: "Popcorn",
      reason: "A simple packaged popcorn option when ingredients stay short.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the same bagged popcorn format.",
    },
    {
      id: "air-popped-popcorn",
      name: "Air-popped popcorn",
      category: "Popcorn",
      reason: "Whole-grain snack with ingredients the user controls.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the popcorn ritual while controlling oil, salt, and additives.",
    },
  ],
  yogurt: [
    {
      id: "plain-greek",
      name: "Plain Greek yogurt",
      category: "Yogurt",
      reason: "High protein and avoids flavored-yogurt added sugars.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the creamy yogurt experience while avoiding most added sugars.",
    },
    {
      id: "siggis-plain",
      name: "Plain Skyr",
      brand: "Siggi's",
      category: "Yogurt",
      reason: "Simple ingredient list and higher protein.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the thick cultured-dairy format with a simpler, higher-protein profile.",
    },
    {
      id: "coconut-yogurt",
      name: "Unsweetened coconut yogurt",
      category: "Yogurt",
      reason: "Good dairy-free option when gums and sugar are limited.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the spoonable yogurt format for users who want a dairy-free option.",
    },
  ],
  milk: [
    {
      id: "organic-milk",
      name: "Organic whole milk",
      category: "Milk",
      reason: "Simple staple with one main ingredient.",
      scoreHint: "Often 9-10",
      similarityReason: "Keeps the same everyday milk use case with a simple ingredient profile.",
    },
    {
      id: "grassfed-milk",
      name: "Grass-fed milk",
      category: "Milk",
      reason: "High-quality dairy option with minimal processing.",
      scoreHint: "Often 9-10",
      similarityReason: "Keeps regular dairy milk behavior while improving sourcing quality.",
    },
    {
      id: "almond-milk",
      name: "Unsweetened almond milk",
      category: "Milk",
      reason: "Choose versions with short ingredient lists.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the pourable milk substitute role while avoiding added sugar.",
    },
  ],
  fruit: [
    {
      id: "whole-apple",
      name: "Fresh whole apple",
      category: "Fruit",
      reason: "Same apple snack format with no packaging or ingredient-label complexity.",
      scoreHint: "Often 10",
      similarityReason: "Keeps the crisp, sweet apple bite while moving to the simplest possible version.",
    },
    {
      id: "unsweetened-applesauce",
      name: "Unsweetened applesauce",
      category: "Fruit",
      reason: "A spoonable apple option when convenience matters.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the apple flavor and snack occasion while avoiding syrup or added sugar.",
    },
    {
      id: "no-syrup-fruit-cup",
      name: "Fruit cup in juice",
      category: "Fruit",
      reason: "A shelf-stable fruit snack when fresh fruit is not convenient.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the ready-to-eat fruit format with a cleaner liquid base than syrup.",
    },
  ],
  jerky: [
    {
      id: "country-archer-beef-stick",
      name: "Grass-Fed Beef Stick",
      brand: "Country Archer",
      category: "Jerky",
      reason: "A meat snack format where cleaner versions can be lower in sugar and additives.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the savory high-protein meat snack format.",
    },
    {
      id: "chomps-beef-stick",
      name: "Original Beef Stick",
      brand: "Chomps",
      category: "Jerky",
      reason: "A directly comparable meat stick with a simpler ingredient profile in many varieties.",
      scoreHint: "Often 7-9",
      similarityReason: "Keeps the grab-and-go savory protein use case.",
    },
    {
      id: "epic-bar",
      name: "Meat Bar",
      brand: "EPIC",
      category: "Jerky",
      reason: "A savory protein snack alternative with recognizable ingredients in many varieties.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps the meat-based snack occasion.",
    },
  ],
  snacks: [
    {
      id: "nuts",
      name: "Dry-roasted nuts",
      category: "Snack",
      reason: "Look for nuts and salt only.",
      scoreHint: "Often 8-10",
      similarityReason: "Keeps the salty snack habit while adding fat and protein from a simpler source.",
    },
    {
      id: "jerky",
      name: "Grass-fed beef stick",
      category: "Snack",
      reason: "Can be a cleaner high-protein snack when sugar and additives are low.",
      scoreHint: "Often 6-8",
      similarityReason: "Keeps a savory grab-and-go snack format with more protein.",
    },
    {
      id: "fruit",
      name: "Fresh fruit",
      category: "Snack",
      reason: "Whole-food snack with no ingredient-label complexity.",
      scoreHint: "Often 10",
      similarityReason: "A fallback only when BetterBite cannot confidently identify a closer packaged-food format.",
    },
  ],
};

const FALLBACK = ALTERNATIVES.snacks;

export function getAlternatives(product: Product): AlternativeProduct[] {
  const classification = classifyProduct(product);
  return ALTERNATIVES[classification.type] ?? FALLBACK;
}

export function classifyProduct(product: Product): ProductClassification {
  const haystack = [
    product.name,
    product.brand,
    product.categoriesText,
    product.categories.join(" "),
    product.ingredientsText,
    product.ingredientsTags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of PRODUCT_TYPE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return { type: rule.type, confidence: rule.confidence };
    }
  }

  return { type: "snacks", confidence: "low" };
}

const PRODUCT_TYPE_RULES: ProductTypeRule[] = [
  {
    type: "pancake_mix",
    confidence: "high",
    patterns: [
      /\b(pancake|waffle|flapjack)s?\b.*\b(mix|mixes)\b/,
      /\b(mix|mixes)\b.*\b(pancake|waffle|flapjack)s?\b/,
      /\bpower\s*cakes?\b/,
      /\bbaking mixes?\b.*\b(pancake|waffle)\b/,
    ],
  },
  {
    type: "soda",
    confidence: "high",
    patterns: [/\b(soda|cola|soft drink|soft drinks|pop|carbonated drink|carbonated drinks)\b/],
  },
  {
    type: "tortilla_chips",
    confidence: "high",
    patterns: [/\b(tortilla chips?|corn chips?|nacho chips?)\b/],
  },
  {
    type: "potato_chips",
    confidence: "high",
    patterns: [/\b(potato chips?|kettle chips?|crisps)\b/],
  },
  {
    type: "chips",
    confidence: "medium",
    patterns: [/\b(chip|chips|crisps)\b/],
  },
  {
    type: "protein_bar",
    confidence: "high",
    patterns: [/\b(protein bar|protein bars|energy protein bar|nutrition protein bar)\b/],
  },
  {
    type: "snack_bar",
    confidence: "medium",
    patterns: [/\b(granola bar|cereal bar|snack bar|fruit bar|nutrition bar|energy bar)\b/],
  },
  {
    type: "granola",
    confidence: "high",
    patterns: [/\b(granola|muesli)\b/],
  },
  {
    type: "cereal",
    confidence: "medium",
    patterns: [/\b(cereal|breakfast cereal|oat cereal)\b/],
  },
  {
    type: "cookies",
    confidence: "high",
    patterns: [/\b(cookie|cookies|biscuit|biscuits|wafer|wafers|sandwich cookies?)\b/],
  },
  {
    type: "crackers",
    confidence: "high",
    patterns: [/\b(cracker|crackers|crispbread)\b/],
  },
  {
    type: "popcorn",
    confidence: "high",
    patterns: [/\b(popcorn|popped corn)\b/],
  },
  {
    type: "yogurt",
    confidence: "high",
    patterns: [/\b(yogurt|yoghurt|skyr)\b/],
  },
  {
    type: "milk",
    confidence: "high",
    patterns: [/\b(milk|dairy beverage)\b/],
  },
  {
    type: "jerky",
    confidence: "high",
    patterns: [/\b(jerky|beef stick|meat stick|meat bar)\b/],
  },
  {
    type: "fruit",
    confidence: "medium",
    patterns: [/\b(fruit|apple|apples|banana|bananas|berries|grapes|orange|oranges|pear|pears)\b/],
  },
];
