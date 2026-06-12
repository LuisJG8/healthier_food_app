import Typesense from "typesense";

const COLLECTION_NAME = "foods";
const INSECURE_KEYS = new Set(["betterbite-local-admin-key", "betterbite-local-search-key", "replace-with-a-random-admin-key", "replace-with-a-random-search-key"]);
const HOST = process.env.VITE_TYPESENSE_HOST ?? "localhost";
const PORT = Number(process.env.VITE_TYPESENSE_PORT ?? "8108");
const PROTOCOL = process.env.VITE_TYPESENSE_PROTOCOL ?? "http";
const SEARCH_KEY_DESCRIPTION = "BetterBite local foods search key";

let client;
let searchKey;

function createClient() {
  return new Typesense.Client({
    nodes: [{ host: HOST, port: PORT, protocol: PROTOCOL }],
    apiKey: requireSecret("TYPESENSE_ADMIN_KEY"),
    connectionTimeoutSeconds: 5,
  });
}

function requireSecret(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set before seeding Typesense.`);
  }

  if (INSECURE_KEYS.has(value)) {
    throw new Error(`${name} must be changed from the documented placeholder/default value.`);
  }

  return value;
}

const foodTemplates = [
  {
    category: "Potato chips",
    bases: ["Classic Kettle Chips", "Avocado Oil Sea Salt Chips", "Sweet Potato Chips", "Thick Cut Potato Crisps", "Sea Salt Potato Chips"],
    brands: ["Boulder Canyon", "Jackson's", "Kettle Brand", "Good Crisp", "LesserEvil"],
    cravingTags: ["salty", "crunchy", "potato", "chips", "fries"],
    formatTags: ["bagged snack", "chips", "crunchy snack", "potato snack"],
    healthTags: ["short ingredient list", "cleaner oil", "lower additive"],
    ingredients: ["potatoes, avocado oil, sea salt", "sweet potatoes, coconut oil, sea salt", "potatoes, olive oil, sea salt"],
    scoreRange: [7, 9],
  },
  {
    category: "Soda",
    bases: ["Classic Cola", "Vintage Cola", "Lemon Lime Soda", "Root Beer", "Ginger Soda"],
    brands: ["Olipop", "Poppi", "Culture Pop", "Zevia", "Reed's"],
    cravingTags: ["cold", "bubbly", "sweet", "soda", "cola"],
    formatTags: ["canned drink", "sparkling drink", "grab and sip"],
    healthTags: ["lower sugar", "no corn syrup", "simple sweetener"],
    ingredients: ["carbonated water, cane sugar, botanicals", "sparkling water, prebiotic fiber, natural flavors", "carbonated water, stevia, natural flavors"],
    scoreRange: [6, 8],
  },
  {
    category: "Sparkling water",
    bases: ["Lime Sparkling Water", "Berry Sparkling Water", "Grapefruit Sparkling Water", "Black Cherry Sparkling Water", "Peach Sparkling Water"],
    brands: ["Spindrift", "Waterloo", "LaCroix", "Topo Chico", "Polar"],
    cravingTags: ["cold", "bubbly", "soda", "refreshing"],
    formatTags: ["canned drink", "sparkling drink", "grab and sip"],
    healthTags: ["no added sugar", "simple ingredient list", "unsweetened"],
    ingredients: ["carbonated water, fruit juice", "carbonated water, natural flavor", "sparkling mineral water"],
    scoreRange: [8, 10],
  },
  {
    category: "Burgers",
    bases: ["Grass Fed Hamburger", "Single Cheeseburger", "Turkey Burger", "Black Bean Burger", "Mushroom Swiss Burger"],
    brands: ["Shake Shack", "Applegate", "Force of Nature", "Dr. Praeger's", "Tribali"],
    cravingTags: ["savory", "burger", "fast food", "handheld"],
    formatTags: ["burger", "hot meal", "sandwich"],
    healthTags: ["better sourcing", "higher protein", "shorter ingredient list"],
    ingredients: ["beef patty, bun, cheese, pickles", "turkey patty, bun, lettuce, tomato", "black beans, brown rice, vegetables, spices"],
    scoreRange: [6, 8],
  },
  {
    category: "Cookies",
    bases: ["Chocolate Chip Cookies", "Double Chocolate Cookies", "Vanilla Sandwich Cookies", "Oatmeal Cookies", "Birthday Cake Cookies"],
    brands: ["Simple Mills", "Partake", "Hu", "Tate's", "Back to Nature"],
    cravingTags: ["sweet", "cookie", "dessert", "chocolate"],
    formatTags: ["boxed snack", "sweet snack", "dessert"],
    healthTags: ["cleaner sweet snack", "gluten free option", "short ingredient list"],
    ingredients: ["almond flour, coconut sugar, chocolate chips", "oat flour, cane sugar, cocoa", "wheat flour, butter, cane sugar, chocolate"],
    scoreRange: [5, 8],
  },
  {
    category: "Cereal",
    bases: ["Cinnamon Cereal", "Honey Oat Cereal", "Chocolate Cereal", "Sprouted Grain Cereal", "Ancient Grain Muesli"],
    brands: ["Seven Sundays", "Magic Spoon", "Cascadian Farm", "Barbara's", "Nature's Path"],
    cravingTags: ["breakfast", "crunchy", "cereal", "sweet"],
    formatTags: ["breakfast bowl", "boxed cereal", "milk pairing"],
    healthTags: ["lower sugar", "whole grain", "higher protein"],
    ingredients: ["whole grain oats, cane sugar, cinnamon", "sprouted wheat, barley, millet", "milk protein, cocoa, allulose"],
    scoreRange: [6, 9],
  },
  {
    category: "Protein bars",
    bases: ["Chocolate Sea Salt Protein Bar", "Peanut Butter Protein Bar", "Vanilla Almond Protein Bar", "Brownie Protein Bar", "Coconut Protein Bar"],
    brands: ["RXBAR", "Aloha", "Perfect Bar", "GoMacro", "No Cow"],
    cravingTags: ["sweet", "protein", "bar", "snack"],
    formatTags: ["grab and go", "bar", "portable snack"],
    healthTags: ["higher protein", "short ingredient list", "lower additive"],
    ingredients: ["dates, egg whites, almonds, cocoa", "brown rice protein, almonds, coconut sugar", "peanut butter, honey, milk protein"],
    scoreRange: [6, 8],
  },
  {
    category: "Yogurt",
    bases: ["Plain Greek Yogurt", "Vanilla Greek Yogurt", "Berry Yogurt", "Coconut Yogurt", "Skyr Yogurt"],
    brands: ["Siggi's", "Fage", "Chobani", "Cocojune", "Maple Hill"],
    cravingTags: ["creamy", "breakfast", "snack", "yogurt"],
    formatTags: ["cup", "spoon snack", "breakfast"],
    healthTags: ["higher protein", "lower sugar", "cultured"],
    ingredients: ["cultured milk, cream", "cultured milk, fruit, cane sugar", "coconut, cultures"],
    scoreRange: [7, 10],
  },
  {
    category: "Crackers",
    bases: ["Sea Salt Crackers", "Almond Flour Crackers", "Cheddar Crackers", "Seed Crackers", "Multigrain Crackers"],
    brands: ["Simple Mills", "Mary's Gone Crackers", "Hu", "Back to Nature", "Milton's"],
    cravingTags: ["salty", "crunchy", "cracker", "snack"],
    formatTags: ["boxed snack", "crackers", "dip pairing"],
    healthTags: ["short ingredient list", "whole grain", "seed based"],
    ingredients: ["almond flour, sunflower seeds, sea salt", "brown rice, quinoa, flax seeds", "wheat flour, cheddar, sea salt"],
    scoreRange: [6, 9],
  },
  {
    category: "Popcorn",
    bases: ["Himalayan Salt Popcorn", "Avocado Oil Popcorn", "White Cheddar Popcorn", "Kettle Corn", "Butter Popcorn"],
    brands: ["LesserEvil", "Boom Chicka Pop", "SkinnyPop", "Pipcorn", "Quinn"],
    cravingTags: ["salty", "crunchy", "popcorn", "snack"],
    formatTags: ["bagged snack", "movie snack", "crunchy snack"],
    healthTags: ["whole grain", "cleaner oil", "simple ingredient list"],
    ingredients: ["popcorn, coconut oil, Himalayan salt", "popcorn, avocado oil, sea salt", "popcorn, cane sugar, sunflower oil, salt"],
    scoreRange: [6, 9],
  },
  {
    category: "Frozen meals",
    bases: ["Chicken Burrito Bowl", "Vegetable Lasagna", "Turkey Meatballs", "Cauliflower Pizza", "Chicken Tikka Masala"],
    brands: ["Saffron Road", "Amy's", "Kevin's", "Caulipower", "Primal Kitchen"],
    cravingTags: ["hot meal", "convenient", "savory", "dinner"],
    formatTags: ["frozen meal", "microwave meal", "quick dinner"],
    healthTags: ["higher protein", "vegetable forward", "lower additive"],
    ingredients: ["chicken, rice, beans, vegetables, spices", "tomatoes, pasta, ricotta, spinach", "cauliflower crust, mozzarella, tomato sauce"],
    scoreRange: [5, 8],
  },
  {
    category: "Candy",
    bases: ["Dark Chocolate Gems", "Peanut Butter Cups", "Sour Gummies", "Chocolate Bar", "Caramel Bites"],
    brands: ["Unreal", "Hu", "SmartSweets", "Lily's", "Theo"],
    cravingTags: ["sweet", "candy", "chocolate", "dessert"],
    formatTags: ["sweet snack", "bagged candy", "dessert"],
    healthTags: ["lower sugar", "no artificial colors", "cleaner sweet snack"],
    ingredients: ["dark chocolate, coconut sugar, cocoa butter", "peanuts, dark chocolate, cane sugar", "soluble fiber, allulose, natural flavor"],
    scoreRange: [4, 8],
  },
  {
    category: "Ice cream",
    bases: ["Vanilla Ice Cream", "Chocolate Ice Cream", "Mint Chip Ice Cream", "Strawberry Ice Cream", "Cookie Dough Ice Cream"],
    brands: ["Alden's", "Jeni's", "NadaMoo", "Cosmic Bliss", "So Delicious"],
    cravingTags: ["sweet", "creamy", "ice cream", "dessert"],
    formatTags: ["frozen dessert", "pint", "spoon dessert"],
    healthTags: ["shorter ingredient list", "organic option", "dairy free option"],
    ingredients: ["milk, cream, cane sugar, vanilla", "coconut milk, cane sugar, cocoa", "cream, milk, strawberries, sugar"],
    scoreRange: [4, 7],
  },
  {
    category: "Fries-style snacks",
    bases: ["Avocado Oil Potato Sticks", "Sweet Potato Fries", "Sea Salt Veggie Straws", "Kettle Potato Fries", "Crispy Potato Bites"],
    brands: ["Boulder Canyon", "Alexia", "Siete", "LesserEvil", "Jackson's"],
    cravingTags: ["salty", "crunchy", "potato", "fries", "fast food"],
    formatTags: ["fries alternative", "potato snack", "hot snack", "crunchy snack"],
    healthTags: ["cleaner oil", "short ingredient list", "better potato snack"],
    ingredients: ["potatoes, avocado oil, sea salt", "sweet potatoes, olive oil, sea salt", "cassava flour, avocado oil, sea salt"],
    scoreRange: [6, 9],
  },
];

function buildFoods() {
  const foods = [];

  for (const template of foodTemplates) {
    for (const brand of template.brands) {
      for (const base of template.bases) {
        const index = foods.length;
        const [minScore, maxScore] = template.scoreRange;
        const score = minScore + ((index * 7) % (maxScore - minScore + 1));
        const ingredient = template.ingredients[index % template.ingredients.length];

        foods.push({
          id: `food-${String(index + 1).padStart(3, "0")}`,
          name: base,
          brand,
          category: template.category,
          cravingTags: template.cravingTags,
          formatTags: template.formatTags,
          healthTags: template.healthTags,
          ingredientsSummary: ingredient,
          betterbiteScore: score,
          imageUrl: "",
        });
      }
    }
  }

  return foods;
}

async function recreateCollection() {
  try {
    await client.collections(COLLECTION_NAME).delete();
    console.log(`Deleted existing ${COLLECTION_NAME} collection.`);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await client.collections().create({
    name: COLLECTION_NAME,
    fields: [
      { name: "name", type: "string" },
      { name: "brand", type: "string", facet: true },
      { name: "category", type: "string", facet: true },
      { name: "cravingTags", type: "string[]", facet: true },
      { name: "formatTags", type: "string[]", facet: true },
      { name: "healthTags", type: "string[]", facet: true },
      { name: "ingredientsSummary", type: "string" },
      { name: "betterbiteScore", type: "int32", sort: true },
    ],
    default_sorting_field: "betterbiteScore",
  });

  console.log(`Created ${COLLECTION_NAME} collection.`);
}

async function seedDocuments() {
  const foods = buildFoods();
  const results = await client.collections(COLLECTION_NAME).documents().import(foods, {
    action: "upsert",
    batch_size: 100,
  });
  const failures = results.filter((result) => !result.success);

  if (failures.length > 0) {
    console.error(failures.slice(0, 5));
    throw new Error(`Failed to import ${failures.length} foods into Typesense.`);
  }

  console.log(`Imported ${foods.length} foods.`);
}

async function ensureSearchOnlyKey() {
  const keys = await client.keys().retrieve();
  const existing = keys.keys.filter((key) => key.description === SEARCH_KEY_DESCRIPTION);

  for (const key of existing) {
    await client.keys(key.id).delete();
  }

  await client.keys().create({
    description: SEARCH_KEY_DESCRIPTION,
    actions: ["documents:search"],
    collections: [COLLECTION_NAME],
    value: searchKey,
  });

  console.log(`Created local search-only key for ${COLLECTION_NAME}.`);
}

function isNotFoundError(error) {
  return error instanceof Error && (error.name === "ObjectNotFound" || error.message.includes("Not Found") || error.message.includes("404"));
}

async function main() {
  searchKey = requireSecret("VITE_TYPESENSE_SEARCH_KEY");
  client = createClient();

  if (process.argv.includes("--reset")) {
    console.log("Resetting local Typesense food search data.");
  }

  await recreateCollection();
  await seedDocuments();
  await ensureSearchOnlyKey();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (!/TYPESENSE_.*must be|VITE_TYPESENSE_SEARCH_KEY must be/.test(message)) {
    console.error("Make sure Typesense is running with: docker compose up -d typesense");
  }
  process.exitCode = 1;
});
