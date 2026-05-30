type BarcodeFormatSet<T extends string> = {
  UPC_A: T;
  UPC_E: T;
  EAN8: T;
  EAN13: T;
};

type NavigatorLike = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

export function getBarcodeScannerFormats<T extends string>(
  formats: BarcodeFormatSet<T>,
  navigatorLike: NavigatorLike = globalThis.navigator ?? {},
): T[] {
  const commonFormats = [formats.UPC_E, formats.EAN8, formats.EAN13];

  if (isIosNavigator(navigatorLike)) {
    return commonFormats;
  }

  return [formats.UPC_A, ...commonFormats];
}

function isIosNavigator(navigatorLike: NavigatorLike): boolean {
  const userAgent = navigatorLike.userAgent ?? "";
  const platform = navigatorLike.platform ?? "";

  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && (navigatorLike.maxTouchPoints ?? 0) > 1);
}
