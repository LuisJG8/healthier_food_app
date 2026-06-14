import type { AlternativeProduct } from "../types";

export type SwapAlternativeIndexes = Record<string, number>;
export type AcceptedSwapIds = Record<string, string>;

export function alternativeAt(alternatives: AlternativeProduct[], index: number, fallback: AlternativeProduct): AlternativeProduct {
  if (alternatives.length === 0) {
    return fallback;
  }

  const safeIndex = ((index % alternatives.length) + alternatives.length) % alternatives.length;
  return alternatives[safeIndex] ?? alternatives[0];
}

export function acceptSwap(acceptedSwapIds: AcceptedSwapIds, barcode: string, alternative: AlternativeProduct): AcceptedSwapIds {
  return { ...acceptedSwapIds, [barcode]: alternative.id };
}

export function shouldReplaceAcceptedSwap(scoreValue: number | null | undefined): boolean {
  return typeof scoreValue === "number" && Number.isFinite(scoreValue) && scoreValue <= 8;
}

export function rejectSwapIndex(
  alternativeIndexes: SwapAlternativeIndexes,
  barcode: string,
  alternativeCount: number,
): SwapAlternativeIndexes {
  const safeAlternativeCount = Math.max(alternativeCount, 1);

  return {
    ...alternativeIndexes,
    [barcode]: ((alternativeIndexes[barcode] ?? 0) + 1) % safeAlternativeCount,
  };
}

export function clearAcceptedSwap(acceptedSwapIds: AcceptedSwapIds, barcode: string): AcceptedSwapIds {
  const next = { ...acceptedSwapIds };
  delete next[barcode];
  return next;
}
