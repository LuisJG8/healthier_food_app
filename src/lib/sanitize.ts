const OPEN_FOOD_FACTS_IMAGE_HOSTS = new Set(["images.openfoodfacts.org", "static.openfoodfacts.org"]);

export function safeOpenFoodFactsImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && OPEN_FOOD_FACTS_IMAGE_HOSTS.has(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
