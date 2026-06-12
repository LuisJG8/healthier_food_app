import Typesense, { type Client, type SearchResponseHit } from "typesense";

export const FOOD_SEARCH_COLLECTION = "foods";
export const FOOD_SEARCH_QUERY_BY = "name,brand,category,cravingTags,formatTags,healthTags,ingredientsSummary";
export const FOOD_SEARCH_PER_PAGE = 20;

const DEFAULT_TYPESENSE_HOST = "localhost";
const DEFAULT_TYPESENSE_PORT = 8108;
const DEFAULT_TYPESENSE_PROTOCOL = "http";
const INSECURE_TYPESENSE_SEARCH_KEYS = new Set(["betterbite-local-search-key", "replace-with-a-random-search-key"]);

export interface FoodSearchDocument {
  id: string;
  name: string;
  brand: string;
  category: string;
  cravingTags: string[];
  formatTags: string[];
  healthTags: string[];
  ingredientsSummary: string;
  betterbiteScore: number;
  imageUrl?: string;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string;
  category: string;
  cravingTags: string[];
  formatTags: string[];
  healthTags: string[];
  ingredientsSummary: string;
  betterbiteScore: number;
  imageUrl?: string;
  textMatch: number;
}

export type FoodSearchStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface FoodSearchState {
  query: string;
  submittedQuery: string;
  status: FoodSearchStatus;
  results: FoodSearchResult[];
  selectedResult: FoodSearchResult | null;
  error: string | null;
}

export type FoodSearchAction =
  | { type: "queryChanged"; query: string }
  | { type: "searchStarted"; query: string }
  | { type: "searchSucceeded"; query: string; results: FoodSearchResult[] }
  | { type: "searchFailed"; query: string; error: string }
  | { type: "resultSelected"; result: FoodSearchResult }
  | { type: "detailClosed" };

export const INITIAL_FOOD_SEARCH_STATE: FoodSearchState = {
  query: "",
  submittedQuery: "",
  status: "idle",
  results: [],
  selectedResult: null,
  error: null,
};

let searchClient: Client | null = null;

export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const response = await getSearchClient()
    .collections<FoodSearchDocument>(FOOD_SEARCH_COLLECTION)
    .documents()
    .search({
      q: trimmedQuery,
      query_by: FOOD_SEARCH_QUERY_BY,
      sort_by: "betterbiteScore:desc",
      per_page: FOOD_SEARCH_PER_PAGE,
    });

  return (response.hits ?? [])
    .map((hit) => mapTypesenseFoodHit(hit))
    .filter((result): result is FoodSearchResult => result !== null);
}

export function reduceFoodSearchState(state: FoodSearchState, action: FoodSearchAction): FoodSearchState {
  switch (action.type) {
    case "queryChanged": {
      const query = action.query;
      if (!query.trim()) {
        return { ...INITIAL_FOOD_SEARCH_STATE, query };
      }
      if (state.status === "loading" && query.trim() !== state.submittedQuery) {
        return {
          ...state,
          query,
          submittedQuery: "",
          status: "idle",
          results: [],
          selectedResult: null,
          error: null,
        };
      }
      return { ...state, query, error: null };
    }
    case "searchStarted":
      return {
        ...state,
        submittedQuery: action.query,
        status: "loading",
        results: [],
        selectedResult: null,
        error: null,
      };
    case "searchSucceeded":
      if (!isCurrentSearchCompletion(state, action.query)) {
        return state;
      }

      return {
        ...state,
        submittedQuery: action.query,
        status: action.results.length > 0 ? "success" : "empty",
        results: action.results,
        selectedResult: action.results[0] ?? null,
        error: null,
      };
    case "searchFailed":
      if (!isCurrentSearchCompletion(state, action.query)) {
        return state;
      }

      return {
        ...state,
        submittedQuery: action.query,
        status: "error",
        results: [],
        selectedResult: null,
        error: action.error,
      };
    case "resultSelected":
      return { ...state, selectedResult: action.result };
    case "detailClosed":
      return { ...state, selectedResult: null };
  }
}

function isCurrentSearchCompletion(state: FoodSearchState, query: string): boolean {
  return state.status === "loading" && state.submittedQuery === query && state.query.trim() === query;
}

export function mapTypesenseFoodHit(hit: SearchResponseHit<FoodSearchDocument>): FoodSearchResult | null {
  const document = mapTypesenseFoodDocument(hit.document);
  if (!document) {
    return null;
  }

  return {
    ...document,
    textMatch: Number.isFinite(hit.text_match) ? hit.text_match : 0,
  };
}

export function mapTypesenseFoodDocument(value: unknown): Omit<FoodSearchResult, "textMatch"> | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanString(value.id, 120);
  const name = cleanString(value.name, 160);
  const category = cleanString(value.category, 120);

  if (!id || !name || !category) {
    return null;
  }

  return {
    id,
    name,
    brand: cleanString(value.brand, 120) || "Unknown brand",
    category,
    cravingTags: cleanStringArray(value.cravingTags, 12),
    formatTags: cleanStringArray(value.formatTags, 12),
    healthTags: cleanStringArray(value.healthTags, 12),
    ingredientsSummary: cleanString(value.ingredientsSummary, 300) || "Ingredient summary is not available for this prototype food.",
    betterbiteScore: cleanScore(value.betterbiteScore),
    imageUrl: cleanImageUrl(value.imageUrl),
  };
}

export function friendlyTypesenseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|network|connection|econnrefused|timeout/i.test(message)) {
    return "Typesense is not running. Start it with docker compose up -d typesense, then run pnpm typesense:seed.";
  }

  if (/unauthorized|forbidden|401|403/i.test(message)) {
    return "Typesense rejected the local search key. Run pnpm typesense:seed to recreate the prototype key.";
  }

  if (/VITE_TYPESENSE_SEARCH_KEY/i.test(message)) {
    return "Typesense search is not configured. Set VITE_TYPESENSE_SEARCH_KEY to the search-only key created by pnpm typesense:seed.";
  }

  return message || "Could not search foods.";
}

function getSearchClient(): Client {
  if (searchClient) {
    return searchClient;
  }

  searchClient = new Typesense.Client({
    nodes: [
      {
        host: import.meta.env.VITE_TYPESENSE_HOST || DEFAULT_TYPESENSE_HOST,
        port: Number(import.meta.env.VITE_TYPESENSE_PORT || DEFAULT_TYPESENSE_PORT),
        protocol: import.meta.env.VITE_TYPESENSE_PROTOCOL || DEFAULT_TYPESENSE_PROTOCOL,
      },
    ],
    apiKey: getTypesenseSearchKey(),
    connectionTimeoutSeconds: 3,
    numRetries: 1,
  });

  return searchClient;
}

function getTypesenseSearchKey(): string {
  const key = String(import.meta.env.VITE_TYPESENSE_SEARCH_KEY ?? "").trim();

  if (!key || INSECURE_TYPESENSE_SEARCH_KEYS.has(key)) {
    throw new Error("VITE_TYPESENSE_SEARCH_KEY must be set to a non-default search-only key.");
  }

  return key;
}

function cleanScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 5;
  }

  return Math.min(10, Math.max(1, Math.round(value)));
}

function cleanStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const text = cleanString(item, 80);
    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    cleaned.push(text);
    if (cleaned.length >= limit) {
      break;
    }
  }

  return cleaned;
}

function cleanString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanImageUrl(value: unknown): string | undefined {
  const text = cleanString(value, 400);
  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
