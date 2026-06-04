import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Apple,
  Barcode,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { Fragment, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import boulderCanyonChips from "./assets/boulder-canyon-chips.avif";
import burgerKingFries from "./assets/burger-king-fries.jpg";
import { getAlternatives } from "./lib/alternatives";
import { buildActivityChart, type ActivityChart } from "./lib/activityChart";
import { getBarcodeError, normalizeBarcode } from "./lib/barcode";
import { fetchProductByBarcode } from "./lib/openFoodFacts";
import { scoreProduct } from "./lib/qualityScore";
import { getBarcodeScannerFormats } from "./lib/scannerFormats";
import { loadActivityDays, loadScanHistory, loadSettings, recordActivity, saveSettings, upsertScanHistory } from "./lib/storage";
import type { ActivityDay, AlternativeProduct, AppSettings, IngredientFlag, Product, QualityScore, ScanHistoryItem } from "./types";

type Tab = "scan" | "swap" | "history" | "profile";
type SwapDetailSide = "original" | "alternative";
type SwapDetail = {
  barcode: string;
  side: SwapDetailSide;
};
type SwapAlternativeIndexes = Record<string, number>;
type AcceptedSwapIds = Record<string, string>;
type SwapCelebrationIds = Record<string, string>;
type HistoryDateGroup = {
  dateKey: string;
  label: string;
  items: ScanHistoryItem[];
};

const LOGIN_ACTIVITY_SESSION_KEY = "betterbite.loginActivityRecorded.v1";
let didRecordLoginThisRuntime = false;

const FALLBACK_SWAP: AlternativeProduct = {
  id: "fallback-boulder-canyon-chips",
  brand: "Boulder Canyon",
  name: "Avocado Oil Classic Sea Salt Kettle Chips",
  category: "Snack",
  reason: "A cleaner chip option made with potatoes, avocado oil, and sea salt.",
  scoreHint: "Simple ingredients",
  similarityReason: "Keeps the salty potato crunch of fries while moving to a simpler chip made with avocado oil.",
};

const TEST_BARCODE = "5449000000996";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [barcode, setBarcode] = useState(TEST_BARCODE);
  const [product, setProduct] = useState<Product | null>(null);
  const [swapProducts, setSwapProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ strictSeedOilPenalty: true });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapDetail, setSwapDetail] = useState<SwapDetail | null>(null);
  const [swapAlternativeIndexes, setSwapAlternativeIndexes] = useState<SwapAlternativeIndexes>({});
  const [acceptedSwapIds, setAcceptedSwapIds] = useState<AcceptedSwapIds>({});
  const [swapCelebrationIds, setSwapCelebrationIds] = useState<SwapCelebrationIds>({});
  const [expandedHistoryDate, setExpandedHistoryDate] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ScanHistoryItem | null>(null);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<Product | null>(null);
  const [selectedHistoryScore, setSelectedHistoryScore] = useState<QualityScore | null>(null);
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);
  const [isHistoryDetailLoading, setIsHistoryDetailLoading] = useState(false);
  const scanResultRef = useRef<HTMLDivElement>(null);

  const qualityScore = useMemo(() => (product ? scoreProduct(product, settings) : null), [product, settings]);
  const alternatives = useMemo(() => (product ? getAlternatives(product) : []), [product]);
  const activityChart = useMemo(() => buildActivityChart(activityDays), [activityDays]);
  const historyGroups = useMemo(() => groupScanHistoryByDate(history), [history]);

  useEffect(() => {
    setHistory(loadScanHistory());
    setSettings(loadSettings());
    setActivityDays(loadActivityDays());

    const loginActivity = recordLoginActivityOnce();
    if (loginActivity) {
      setActivityDays(loginActivity);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "scan" || !product) {
      return;
    }

    scrollScanResultIntoView();
  }, [activeTab, product]);

  function scrollScanResultIntoView(): void {
    requestAnimationFrame(() => {
      scanResultRef.current?.scrollIntoView({ block: "start" });
      window.setTimeout(() => {
        scanResultRef.current?.scrollIntoView({ block: "start" });
      }, 80);
    });
  }

  async function handleLookup(input = barcode) {
    const validationError = getBarcodeError(input);

    if (validationError) {
      setProduct(null);
      setError(validationError);
      return;
    }

    const normalized = normalizeBarcode(input);

    setIsLoading(true);
    setError(null);
    setProduct(null);

    try {
      const nextProduct = await fetchProductByBarcode(normalized);
      const nextScore = scoreProduct(nextProduct, settings);
      setProduct(nextProduct);
      setSwapProducts((existing) => [nextProduct, ...existing.filter((entry) => entry.barcode !== nextProduct.barcode)].slice(0, 20));
      setBarcode(normalized);
      setSwapDetail(null);
      setActiveTab("scan");
      setHistory(
        upsertScanHistory({
          barcode: nextProduct.barcode,
          productName: nextProduct.name,
          brand: nextProduct.brand,
          score: nextScore.value,
          imageUrl: nextProduct.imageUrl,
          scannedAt: new Date().toISOString(),
        }),
      );
      setActivityDays(recordActivity("barcode_scan"));
      scrollScanResultIntoView();
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : "Could not fetch this product.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScanWithCamera() {
    if (!isTauriRuntime()) {
      setError("Camera scanning is available in the Tauri mobile app. Use barcode entry in desktop preview.");
      return;
    }

    try {
      const scanner = await import("@tauri-apps/plugin-barcode-scanner");
      const permission = await scanner.requestPermissions();

      if (permission !== "granted") {
        setError("Camera permission is required to scan a barcode.");
        return;
      }

      const scanned = await scanner.scan({
        cameraDirection: "back",
        formats: getBarcodeScannerFormats(scanner.Format),
        windowed: true,
      });

      setBarcode(scanned.content);
      await handleLookup(scanned.content);
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Barcode scanner is unavailable on this target.";
      setError(message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleLookup();
  }

  function updateStrictSetting(value: boolean) {
    const next = { ...settings, strictSeedOilPenalty: value };
    setSettings(next);
    saveSettings(next);
  }

  function handleTabChange(nextTab: Tab) {
    if (nextTab === "profile" && activeTab !== "profile") {
      setActivityDays(recordActivity("profile_view"));
    }

    if (nextTab !== "swap") {
      setSwapDetail(null);
      setSwapCelebrationIds({});
    }

    if (nextTab !== "history") {
      clearHistoryDetail();
    }

    setActiveTab(nextTab);
  }

  function handleAlternativeAccept(product: Product, alternative: AlternativeProduct) {
    setAcceptedSwapIds((existing) => ({ ...existing, [product.barcode]: alternative.id }));
    setSwapCelebrationIds((existing) => ({ ...existing, [product.barcode]: alternative.id }));

    window.setTimeout(() => {
      setSwapCelebrationIds((existing) => {
        if (existing[product.barcode] !== alternative.id) {
          return existing;
        }

        const next = { ...existing };
        delete next[product.barcode];
        return next;
      });
    }, 1100);
  }

  function handleAlternativeReject(product: Product) {
    const nextAlternatives = getAlternatives(product);
    const alternativeCount = Math.max(nextAlternatives.length, 1);

    setSwapAlternativeIndexes((existing) => ({
      ...existing,
      [product.barcode]: ((existing[product.barcode] ?? 0) + 1) % alternativeCount,
    }));
    setAcceptedSwapIds((existing) => {
      const next = { ...existing };
      delete next[product.barcode];
      return next;
    });
  }

  async function handleHistoryItemSelect(item: ScanHistoryItem) {
    setSelectedHistoryItem(item);
    setSelectedHistoryProduct(null);
    setSelectedHistoryScore(null);
    setHistoryDetailError(null);
    setIsHistoryDetailLoading(true);

    try {
      const nextProduct = await fetchProductByBarcode(item.barcode);
      setSelectedHistoryProduct(nextProduct);
      setSelectedHistoryScore(scoreProduct(nextProduct, settings));
    } catch (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Could not load full product details.";
      setHistoryDetailError(message);
    } finally {
      setIsHistoryDetailLoading(false);
    }
  }

  function clearHistoryDetail() {
    setSelectedHistoryItem(null);
    setSelectedHistoryProduct(null);
    setSelectedHistoryScore(null);
    setHistoryDetailError(null);
    setIsHistoryDetailLoading(false);
  }

  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[430px] flex-col bg-cream shadow-soft md:my-6 md:h-[900px] md:max-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[34px]">
        <section className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-safe-offset">
          <AnimatePresence mode="wait">
            {activeTab === "scan" && (
              <motion.div
                key="scan"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <ScannerCard
                  barcode={barcode}
                  error={error}
                  isLoading={isLoading}
                  onBarcodeChange={setBarcode}
                  onSubmit={handleSubmit}
                  onCameraScan={handleScanWithCamera}
                />

                {product && qualityScore ? (
                  <div ref={scanResultRef}>
                    <ProductResult product={product} score={qualityScore} alternatives={alternatives} />
                  </div>
                ) : (
                  <EmptyState />
                )}
              </motion.div>
            )}

            {activeTab === "swap" && (
              <motion.div
                key="swap"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <SwapScreen
                  products={swapProducts}
                  settings={settings}
                  detail={swapDetail}
                  alternativeIndexes={swapAlternativeIndexes}
                  acceptedSwapIds={acceptedSwapIds}
                  celebrationIds={swapCelebrationIds}
                  onDetailChange={setSwapDetail}
                  onAlternativeAccept={handleAlternativeAccept}
                  onAlternativeReject={handleAlternativeReject}
                />
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                {selectedHistoryItem ? (
                  <HistoryFoodDetail
                    item={selectedHistoryItem}
                    product={selectedHistoryProduct}
                    score={selectedHistoryScore}
                    isLoading={isHistoryDetailLoading}
                    error={historyDetailError}
                    onBack={clearHistoryDetail}
                  />
                ) : (
                  <>
                    <SectionTitle eyebrow="Local" title="Scan history" />
                    {history.length > 0 ? (
                  <div className="space-y-3">
                    {historyGroups.map((group) => {
                      const isExpanded = expandedHistoryDate === group.dateKey;

                      return (
                        <div key={group.dateKey} className="space-y-2">
                          <button
                            className="bento-card flex w-full items-center gap-3 p-4 text-left outline-none transition hover:border-leaf focus-visible:ring-2 focus-visible:ring-leaf/35"
                            onClick={() => setExpandedHistoryDate(isExpanded ? null : group.dateKey)}
                            aria-expanded={isExpanded}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-black">{group.label}</p>
                              <p className="mt-1 text-xs font-bold text-muted">
                                {group.items.length} scanned item{group.items.length === 1 ? "" : "s"}
                              </p>
                            </div>
                            <ChevronRight className={`shrink-0 text-muted transition ${isExpanded ? "rotate-90" : ""}`} size={20} />
                          </button>

                          {isExpanded && (
                            <div className="space-y-2 pl-3">
                              {group.items.map((item) => (
                                <button
                                  key={`${item.barcode}-${item.scannedAt}`}
                                  className="bento-card grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 p-3 text-left outline-none transition hover:border-leaf focus-visible:ring-2 focus-visible:ring-leaf/35"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => void handleHistoryItemSelect(item)}
                                >
                                  <ProductThumb imageUrl={item.imageUrl} name={item.productName} />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{item.productName}</p>
                                    <p className="truncate text-xs text-muted">{item.brand ?? item.barcode}</p>
                                  </div>
                                  <ScoreBadge value={item.score} size="sm" />
                                  <ChevronRight size={17} className="shrink-0 text-muted" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                    ) : (
                  <div className="bento-card p-5">
                    <History className="mb-4 text-leaf" size={28} />
                    <h2 className="text-xl font-black">No scans yet</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Products you scan or search by barcode will stay on this device for quick comparison.
                    </p>
                  </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <SectionTitle eyebrow="Profile" title="Your activity" />
                <ActivityCard chart={activityChart} />
                <SectionTitle eyebrow="Preferences" title="Ingredient profile" />
                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black">Strict clean-label scoring</h2>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        BetterBite weighs seed oils, artificial colors, sweeteners, preservatives, additives, and
                        ultra-processing heavily.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={settings.strictSeedOilPenalty}
                      className={`h-8 w-14 rounded-full p-1 transition ${settings.strictSeedOilPenalty ? "bg-leaf" : "bg-line"}`}
                      onClick={() => updateStrictSetting(!settings.strictSeedOilPenalty)}
                      aria-label="Toggle strict clean-label scoring"
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-cream shadow-sm transition ${
                          settings.strictSeedOilPenalty ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="bento-card bg-berry p-5 text-cream">
                  <Sparkles className="mb-4 text-sky" size={28} />
                  <h2 className="text-lg font-black">MVP disclaimer</h2>
                  <p className="mt-2 text-sm leading-6 text-cream/85">
                    Scores are ingredient-quality guidance, not medical advice. Always review the product label,
                    especially for allergies and dietary needs.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <nav className="shrink-0 border-t border-line bg-cream/95 px-4 pb-safe-offset pt-2 backdrop-blur">
          <div className="grid grid-cols-4">
            <NavButton
              testId="nav-scan"
              active={activeTab === "scan"}
              icon={<Barcode size={21} />}
              label="Scan"
              onClick={() => handleTabChange("scan")}
            />
            <NavButton
              testId="nav-swap"
              active={activeTab === "swap"}
              icon={<RefreshCw size={21} />}
              label="Swap"
              onClick={() => handleTabChange("swap")}
            />
            <NavButton
              testId="nav-profile"
              active={activeTab === "profile"}
              icon={<User size={21} />}
              label="Profile"
              onClick={() => handleTabChange("profile")}
            />
            <NavButton
              testId="nav-history"
              active={activeTab === "history"}
              icon={<History size={21} />}
              label="History"
              onClick={() => handleTabChange("history")}
            />
          </div>
        </nav>
      </div>
    </main>
  );
}

function HistoryFoodDetail({
  item,
  product,
  score,
  isLoading,
  error,
  onBack,
}: {
  item: ScanHistoryItem;
  product: Product | null;
  score: QualityScore | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const detailName = product?.name ?? item.productName;
  const detailBrand = product?.brand ?? item.brand;
  const ingredients = product ? splitIngredients(product.ingredientsText) : [];
  const nutrimentRows = product ? productDataRows(product.nutriments) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oat text-ink outline-none transition hover:bg-line focus-visible:ring-2 focus-visible:ring-leaf/35"
          onClick={onBack}
          aria-label="Back to scan history"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">History detail</p>
          <h2 className="mt-1 truncate text-xl font-black">{detailName}</h2>
        </div>
      </div>

      <div className="bento-card p-4">
        <div className="flex items-center gap-3">
          <ProductThumb imageUrl={product?.imageUrl ?? item.imageUrl} name={detailName} large />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{detailBrand ?? product?.source ?? "Saved scan"}</p>
            <h3 className="mt-1 line-clamp-2 text-xl font-black leading-tight">{detailName}</h3>
            <p className="mt-1 text-xs font-bold text-muted">{formatHistoryDateTime(item.scannedAt)}</p>
          </div>
          <ScoreBadge value={score?.value ?? item.score} />
        </div>
      </div>

      {isLoading && (
        <div className="bento-card flex items-center gap-3 p-4 text-sm font-bold text-muted">
          <Loader2 className="animate-spin text-leaf" size={18} />
          Loading full product details...
        </div>
      )}

      {error && (
        <div className="bento-card flex items-start gap-3 p-4 text-sm font-semibold text-ink">
          <AlertTriangle className="mt-0.5 shrink-0 text-leaf" size={18} />
          <div>
            <p className="font-black">Full product details unavailable</p>
            <p className="mt-1 leading-5 text-muted">{error}</p>
            <p className="mt-2 leading-5 text-muted">Saved history still includes the barcode, score, scan date, and product name below.</p>
          </div>
        </div>
      )}

      <HistoryDetailSection title="Saved scan">
        <HistoryDataRow label="Product" value={item.productName} />
        <HistoryDataRow label="Brand" value={item.brand ?? "Not saved"} />
        <HistoryDataRow label="Barcode" value={item.barcode} />
        <HistoryDataRow label="Saved score" value={`${item.score}/10`} />
        <HistoryDataRow label="Scanned" value={formatHistoryDateTime(item.scannedAt)} />
      </HistoryDetailSection>

      {product && score && (
        <HistoryDetailSection title="Score data">
          <HistoryDataRow label="Score" value={`${score.value}/10`} />
          <HistoryDataRow label="Label" value={score.label} />
          <HistoryDataRow label="Confidence" value={score.confidence} />
          <p className="rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold leading-5 text-muted">{score.summary}</p>
        </HistoryDetailSection>
      )}

      {product && (
        <>
          <HistoryDetailSection title="Product data">
            <HistoryDataRow label="Name" value={product.name} />
            <HistoryDataRow label="Brand" value={product.brand ?? "Unknown"} />
            <HistoryDataRow label="Barcode" value={product.barcode} />
            <HistoryDataRow label="Source" value={formatProductSource(product.source)} />
            <HistoryDataRow label="Categories" value={product.categoriesText ?? formatList(product.categories)} />
            <HistoryDataRow label="NOVA group" value={product.novaGroup?.toString() ?? "Not available"} />
            <HistoryDataRow label="Nutri-Score" value={product.nutriscoreGrade?.toUpperCase() ?? "Not available"} />
            <HistoryDataRow label="Eco-Score" value={product.ecoscoreGrade?.toUpperCase() ?? "Not available"} />
          </HistoryDetailSection>

          <HistoryDetailSection title="Ingredients">
            {product.ingredientsText ? (
              <>
                <p className="rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold leading-5 text-muted">{product.ingredientsText}</p>
                {ingredients.length > 0 && (
                  <div className="grid gap-2">
                    {ingredients.map((ingredient) => (
                      <div key={ingredient} className="flex items-start gap-2 rounded-[8px] border border-line bg-cream px-3 py-2">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-leaf" />
                        <p className="text-sm font-semibold leading-5">{ingredient}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-muted">No ingredient text was provided for this product.</p>
            )}
          </HistoryDetailSection>

          <HistoryDetailSection title="Tags and labels">
            <HistoryChipGroup label="Ingredient tags" values={product.ingredientsTags} />
            <HistoryChipGroup label="Additives" values={product.additivesTags} />
            <HistoryChipGroup label="Allergens" values={product.allergensTags} />
            <HistoryChipGroup label="Labels" values={product.labelsTags} />
          </HistoryDetailSection>

          <HistoryDetailSection title="Nutrition data">
            {nutrimentRows.length > 0 ? (
              <div className="grid gap-2">
                {nutrimentRows.map(([key, value]) => (
                  <HistoryDataRow key={key} label={formatDataKey(key)} value={formatDataValue(value)} />
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-muted">No nutrition data was provided for this product.</p>
            )}
          </HistoryDetailSection>

          {score && (score.flags.length > 0 || score.positives.length > 0) && (
            <HistoryDetailSection title="Score signals">
              {[...score.flags, ...score.positives].map((flag) => (
                <div key={flag.id} className="flex items-start gap-2 rounded-[8px] border border-line bg-cream px-3 py-2">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${flagColor(flag.severity)}`} />
                  <div>
                    <p className="text-sm font-black">{flag.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-muted">{flag.description}</p>
                  </div>
                </div>
              ))}
            </HistoryDetailSection>
          )}
        </>
      )}
    </div>
  );
}

function HistoryDetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bento-card space-y-3 p-4">
      <h3 className="text-base font-black">{title}</h3>
      {children}
    </div>
  );
}

function HistoryDataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[8px] border border-line bg-cream px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="break-words text-sm font-bold leading-5">{value}</p>
    </div>
  );
}

function HistoryChipGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-black text-muted">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-muted">Not available</p>
      )}
    </div>
  );
}

function groupScanHistoryByDate(history: ScanHistoryItem[]): HistoryDateGroup[] {
  const groups = new Map<string, ScanHistoryItem[]>();

  for (const item of history) {
    const dateKey = historyDateKey(item.scannedAt);
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), item]);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatHistoryDateLabel(dateKey),
      items,
    }));
}

function historyDateKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHistoryDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatHistoryDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function splitIngredients(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not available";
}

function formatProductSource(source: Product["source"]): string {
  return source === "open-food-facts" ? "Open Food Facts" : "Demo product";
}

function productDataRows(data: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(data).sort(([left], [right]) => left.localeCompare(right));
}

function formatDataKey(key: string): string {
  return key.replace(/_/g, " ").replace(/-/g, " ");
}

function formatDataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function alternativeAt(alternatives: AlternativeProduct[], index: number): AlternativeProduct {
  if (alternatives.length === 0) {
    return FALLBACK_SWAP;
  }

  return alternatives[index % alternatives.length] ?? alternatives[0];
}

function SwapScreen({
  products,
  settings,
  detail,
  alternativeIndexes,
  acceptedSwapIds,
  celebrationIds,
  onDetailChange,
  onAlternativeAccept,
  onAlternativeReject,
}: {
  products: Product[];
  settings: AppSettings;
  detail: SwapDetail | null;
  alternativeIndexes: SwapAlternativeIndexes;
  acceptedSwapIds: AcceptedSwapIds;
  celebrationIds: SwapCelebrationIds;
  onDetailChange: (detail: SwapDetail | null) => void;
  onAlternativeAccept: (product: Product, alternative: AlternativeProduct) => void;
  onAlternativeReject: (product: Product) => void;
}) {
  const hasStarterDetail = detail?.barcode === "starter";
  const selectedProduct = detail ? products.find((entry) => entry.barcode === detail.barcode) ?? null : null;
  const selectedScore = selectedProduct ? scoreProduct(selectedProduct, settings) : null;
  const selectedAlternatives = selectedProduct ? getAlternatives(selectedProduct) : [];
  const selectedAlternativeIndex = selectedProduct ? alternativeIndexes[selectedProduct.barcode] ?? 0 : 0;
  const selectedAlternative = alternativeAt(selectedAlternatives, selectedAlternativeIndex);
  const selectedProductIsBetterPick = Boolean(selectedProduct && selectedScore && selectedScore.value >= 8);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {detail && (selectedProduct || hasStarterDetail) ? (
        <motion.div
          key={`${detail.barcode}-${detail.side}`}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22 }}
        >
          <SwapFoodDetailScreen
            detail={detail.side}
            product={selectedProduct}
            score={selectedScore}
            alternative={selectedAlternative}
            scannedProductIsBetterPick={selectedProductIsBetterPick}
            originalImageUrl={selectedProduct?.imageUrl ?? burgerKingFries}
            alternativeImageUrl={alternativeImageFor(selectedAlternative)}
            onBack={() => onDetailChange(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="swap-overview"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.22 }}
          className="space-y-4"
        >
          <SectionTitle eyebrow="Swap" title={products.length > 0 ? "All scanned swaps" : "Interchangeable picks"} />

          {products.length > 0 ? (
            <div className="space-y-4">
              {products.map((entry) => {
                const entryScore = scoreProduct(entry, settings);
                const entryAlternatives = getAlternatives(entry);
                const entryAlternativeIndex = alternativeIndexes[entry.barcode] ?? 0;
                const entryAlternative = alternativeAt(entryAlternatives, entryAlternativeIndex);
                return (
                  <SwapComparisonCard
                    key={entry.barcode}
                    product={entry}
                    score={entryScore}
                    alternative={entryAlternative}
                    alternativeIndex={entryAlternativeIndex}
                    alternativeCount={entryAlternatives.length}
                    isAccepted={acceptedSwapIds[entry.barcode] === entryAlternative.id}
                    isCelebrating={celebrationIds[entry.barcode] === entryAlternative.id}
                    onDetailChange={(side) => onDetailChange({ barcode: entry.barcode, side })}
                    onAlternativeAccept={() => onAlternativeAccept(entry, entryAlternative)}
                    onAlternativeReject={() => onAlternativeReject(entry)}
                  />
                );
              })}
            </div>
          ) : (
            <SwapComparisonCard
              product={null}
              score={null}
              alternative={FALLBACK_SWAP}
              onDetailChange={(side) => onDetailChange({ barcode: "starter", side })}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SwapComparisonCard({
  product,
  score,
  alternative,
  alternativeIndex = 0,
  alternativeCount = 0,
  isAccepted = false,
  isCelebrating = false,
  onDetailChange,
  onAlternativeAccept,
  onAlternativeReject,
}: {
  product: Product | null;
  score: QualityScore | null;
  alternative: AlternativeProduct;
  alternativeIndex?: number;
  alternativeCount?: number;
  isAccepted?: boolean;
  isCelebrating?: boolean;
  onDetailChange: (side: SwapDetailSide) => void;
  onAlternativeAccept?: () => void;
  onAlternativeReject?: () => void;
}) {
  const scannedProductIsLessIdeal = Boolean(product && score && score.value < 8);
  const scannedProductIsBetterPick = Boolean(product && score && score.value >= 8);
  const alternativeName = alternative.brand ? `${alternative.brand} ${alternative.name}` : alternative.name;
  const leftName = product?.name ?? "Burger King fries";
  const leftDetail = product ? scannedProductDetail(product, score) : "Fast-food fries";
  const rightDetail = scannedProductIsBetterPick ? `Similar or better: ${alternative.scoreHint}` : alternative.scoreHint;
  const originalImageUrl = product ? product.imageUrl : burgerKingFries;
  const alternativeImageUrl = product ? alternativeImageFor(alternative) : boulderCanyonChips;
  const originalTone = scannedProductIsLessIdeal || !product ? "bad" : "good";
  const originalLabel = product ? (scannedProductIsBetterPick ? "Current pick" : "Scanned food") : "Less ideal";
  const alternativeLabel = scannedProductIsBetterPick ? "Similar or better" : "Better swap";
  const swapSummary = product
    ? scannedProductIsLessIdeal
      ? `${product.name} is paired with the first cleaner alternative for its category.`
      : `${product.name} already scores well, so BetterBite suggests a similar option with equal or cleaner ingredient quality.`
    : "Scan products to build a running list of personalized swaps.";

  return (
    <div className="bento-card relative overflow-hidden">
      <div className="bg-oat px-4 py-3">
        <p className="text-sm font-bold leading-6 text-muted">{swapSummary}</p>
      </div>

      <div className="grid grid-cols-[1fr_44px_1fr] items-start gap-2 p-4">
        <SwapFoodPanel
          tone={originalTone}
          label={originalLabel}
          name={leftName}
          detail={leftDetail}
          imageUrl={originalImageUrl}
          onSelect={() => onDetailChange("original")}
        />

        <div className="flex h-[132px] items-center justify-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink shadow-inset"
            aria-label="Interchangeable foods"
            title="Interchangeable foods"
          >
            <RefreshCw size={22} strokeWidth={2.5} />
          </div>
        </div>

        <SwapFoodPanel
          tone="good"
          label={alternativeLabel}
          name={alternativeName}
          detail={rightDetail}
          imageUrl={alternativeImageUrl}
          onSelect={() => onDetailChange("alternative")}
        />
      </div>

      <AnimatePresence initial={false}>
        {product && !isAccepted && (
          <motion.div
            key="swap-feedback"
            className="overflow-hidden border-t border-line bg-cream"
            initial={{ opacity: 1, height: "auto", y: 0 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -18 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Good swap?</p>
                <p className="mt-1 text-xs font-bold text-muted">
                  Option {(alternativeIndex % Math.max(alternativeCount, 1)) + 1} of {Math.max(alternativeCount, 1)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-oat px-3 text-xs font-black text-leaf outline-none transition hover:bg-sky focus-visible:ring-2 focus-visible:ring-leaf/35"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onAlternativeAccept}
                  aria-label={`Yes, save ${alternativeName}`}
                >
                  <ThumbsUp size={16} />
                  Yes
                </button>
                <button
                  className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-oat px-3 text-xs font-black text-ink outline-none transition hover:bg-sky focus-visible:ring-2 focus-visible:ring-leaf/35 disabled:cursor-not-allowed disabled:opacity-45"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onAlternativeReject}
                  disabled={alternativeCount <= 1}
                  aria-label={`No, show another swap instead of ${alternativeName}`}
                >
                  <ThumbsDown size={16} />
                  No
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {product && isCelebrating && <SwapAcceptedConfetti key={`${product.barcode}-${alternative.id}`} />}
      </AnimatePresence>
    </div>
  );
}

function SwapAcceptedConfetti() {
  const pieces = [
    { x: -58, y: -64, rotate: -28, color: "#306D29", shape: "rounded-full", delay: 0 },
    { x: -38, y: -86, rotate: 34, color: "#E7E1B1", shape: "rounded-[2px]", delay: 0.03 },
    { x: -14, y: -72, rotate: 108, color: "#0D530E", shape: "rounded-[2px]", delay: 0.06 },
    { x: 16, y: -92, rotate: -76, color: "#306D29", shape: "rounded-full", delay: 0.02 },
    { x: 42, y: -68, rotate: 146, color: "#E7E1B1", shape: "rounded-[2px]", delay: 0.08 },
    { x: 60, y: -42, rotate: -132, color: "#0D530E", shape: "rounded-full", delay: 0.05 },
    { x: -64, y: -30, rotate: 88, color: "#E7E1B1", shape: "rounded-[2px]", delay: 0.09 },
    { x: 2, y: -112, rotate: 18, color: "#306D29", shape: "rounded-[2px]", delay: 0.12 },
    { x: 30, y: -24, rotate: 72, color: "#0D530E", shape: "rounded-[2px]", delay: 0.11 },
  ];

  return (
    <motion.div
      className="pointer-events-none absolute bottom-7 right-10 h-2 w-2"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      aria-hidden="true"
    >
      {pieces.map((piece) => (
        <motion.span
          key={`${piece.x}-${piece.y}`}
          className={`absolute left-0 top-0 h-2 w-3 ${piece.shape}`}
          style={{ backgroundColor: piece.color }}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, piece.x, piece.x * 1.05],
            y: [0, piece.y, piece.y + 34],
            rotate: [0, piece.rotate, piece.rotate + 70],
            scale: [0.4, 1, 0.75],
          }}
          transition={{ duration: 0.95, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
      <motion.span
        className="absolute left-0 top-0 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-leaf"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.7, 0], scale: [0.2, 1.45, 1.8] }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      />
    </motion.div>
  );
}

function SwapFoodDetailScreen({
  detail,
  product,
  score,
  alternative,
  scannedProductIsBetterPick,
  originalImageUrl,
  alternativeImageUrl,
  onBack,
}: {
  detail: SwapDetailSide;
  product: Product | null;
  score: QualityScore | null;
  alternative: AlternativeProduct;
  scannedProductIsBetterPick: boolean;
  originalImageUrl?: string;
  alternativeImageUrl?: string;
  onBack: () => void;
}) {
  const isOriginal = detail === "original";
  const originalIsLowerQuality = isOriginal && !scannedProductIsBetterPick;
  const alternativeName = alternative.brand ? `${alternative.brand} ${alternative.name}` : alternative.name;
  const originalName = product ? product.name : "Burger King fries";
  const betterName = alternativeName;
  const name = isOriginal ? originalName : betterName;
  const meta = isOriginal ? (product ? scannedProductDetail(product, score) : "Fast-food fries") : alternative.category;
  const imageUrl = isOriginal ? originalImageUrl : alternativeImageUrl;
  const reason = isOriginal
    ? scannedProductIsBetterPick
      ? currentPickReason(score)
      : originalSwapReason(score)
    : scannedProductIsBetterPick
      ? similarOrBetterSwapReason(alternative, score)
      : betterSwapReason(alternative);
  const supportingReasons = isOriginal
    ? scannedProductIsBetterPick
      ? currentPickSupportingReasons(score)
      : originalSupportingReasons(score)
    : scannedProductIsBetterPick
      ? similarOrBetterSupportingReasons(alternative, score)
      : betterSupportingReasons(alternative);
  const detailLabel = isOriginal ? (scannedProductIsBetterPick ? "Current pick" : product ? "Scanned food" : "Less ideal") : scannedProductIsBetterPick ? "Similar or better" : "Better swap";
  const detailTitle = isOriginal
    ? scannedProductIsBetterPick
      ? "Why this is solid"
      : "Why it scores lower"
    : scannedProductIsBetterPick
      ? "Why this also fits"
      : "Why this is closer";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oat text-ink transition hover:bg-line"
          onClick={onBack}
          aria-label="Back to swap comparison"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className={`text-xs font-black uppercase tracking-[0.2em] ${originalIsLowerQuality ? "text-ink" : "text-leaf"}`}>
            {detailLabel}
          </p>
          <h2 className="mt-1 truncate text-xl font-black">{detailTitle}</h2>
        </div>
      </div>

      <div className="bento-card overflow-hidden">
        <div className={`${originalIsLowerQuality ? "bg-sky" : "bg-oat"} p-5`}>
          <div className="mx-auto flex aspect-square max-h-[220px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[8px] bg-cream/70">
            {imageUrl ? <img className="h-full w-full object-contain p-4" src={imageUrl} alt={name} /> : <Apple className="text-leaf" size={64} />}
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{meta}</p>
            <h3 className="mt-1 text-xl font-black leading-tight">{name}</h3>
          </div>

          <p className="text-sm font-semibold leading-6 text-muted">{reason}</p>

          <div className="grid gap-2">
            {supportingReasons.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-[8px] bg-oat px-3 py-2">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${originalIsLowerQuality ? "bg-ink" : "bg-leaf"}`} />
                <p className="text-sm font-semibold leading-5 text-ink">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SwapFoodPanel({
  tone,
  label,
  name,
  detail,
  imageUrl,
  onSelect,
}: {
  tone: "bad" | "good";
  label: string;
  name: string;
  detail: string;
  imageUrl?: string;
  onSelect: () => void;
}) {
  const isBad = tone === "bad";

  return (
    <button className="min-w-0 text-left" onClick={onSelect} aria-label={`View details for ${name}`}>
      <div
        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[8px] border ${
          isBad ? "border-line bg-sky" : "border-line bg-oat"
        }`}
      >
        {imageUrl ? <img className="h-full w-full object-contain p-2" src={imageUrl} alt={name} /> : <Apple className="text-leaf" size={34} />}
      </div>
      <p className={`mt-3 text-[10px] font-black uppercase tracking-[0.16em] ${isBad ? "text-ink" : "text-leaf"}`}>{label}</p>
      <h3 className="mt-1 line-clamp-2 text-sm font-black leading-5">{name}</h3>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-muted">{detail}</p>
    </button>
  );
}

function originalSwapReason(score: QualityScore | null): string {
  if (score) {
    return score.summary;
  }

  return "This still satisfies a salty potato craving, but fast-food fries are usually a more processed option with frying oils and sodium that BetterBite treats as lower-quality signals.";
}

function originalSupportingReasons(score: QualityScore | null): string[] {
  if (score?.flags.length) {
    return score.flags.slice(0, 3).map((flag) => flag.description);
  }

  return [
    "Often built around frying oils rather than a short ingredient list.",
    "Usually higher in sodium for a small side portion.",
    "More processed than a cleaner salty potato snack.",
  ];
}

function scannedProductDetail(product: Product, score: QualityScore | null): string {
  const scoreText = score ? `${score.label} (${score.value}/10)` : "Scanned product";
  return product.brand ? `${product.brand} - ${scoreText}` : scoreText;
}

function alternativeImageFor(alternative: AlternativeProduct): string | undefined {
  return alternative.id === FALLBACK_SWAP.id ? boulderCanyonChips : undefined;
}

function betterSwapReason(alternative: AlternativeProduct): string {
  const similarity = alternative.similarityReason ?? "It keeps the same eating occasion while moving toward a cleaner ingredient profile.";
  return `${alternative.reason} ${similarity}`;
}

function similarOrBetterSwapReason(alternative: AlternativeProduct, score: QualityScore | null): string {
  const scoreText = score ? `Your scanned item already scores ${score.value}/10. ` : "";
  return `${scoreText}${betterSwapReason(alternative)}`;
}

function betterSupportingReasons(alternative: AlternativeProduct): string[] {
  return [
    alternative.scoreHint,
    alternative.similarityReason ?? "Similar enough to satisfy the same craving, but with better ingredient-quality tradeoffs.",
    "Chosen as a closer alternative, not an unrelated healthy food.",
  ];
}

function currentPickReason(score: QualityScore | null): string {
  if (!score) {
    return "This scanned item does not have enough score context yet, so BetterBite should not call it less ideal.";
  }

  return `${score.summary} Because it scores ${score.value}/10, BetterBite treats it as a good starting point and compares it with similar choices instead of replacing it with an unrelated healthy food.`;
}

function currentPickSupportingReasons(score: QualityScore | null): string[] {
  if (!score) {
    return ["Needs confirmed ingredient data before BetterBite makes a stronger claim."];
  }

  const positives = score.positives.slice(0, 2).map((flag) => flag.description);
  return [`Score is ${score.value}/10, which meets the good-pick threshold.`, ...positives, "It stays as the current craving being matched, not as something to punish."];
}

function similarOrBetterSupportingReasons(alternative: AlternativeProduct, score: QualityScore | null): string[] {
  return [
    score ? `Recommended because the scan is already strong at ${score.value}/10, so the swap should be similar or cleaner.` : "Recommended as a similar option while score context is limited.",
    alternative.scoreHint,
    alternative.similarityReason ?? "Keeps the same craving, texture, or eating occasion instead of jumping to an unrelated food.",
  ];
}

function ActivityCard({ chart }: { chart: ActivityChart }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const compactDayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="bento-card overflow-hidden p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-sky text-leaf">
            <CalendarDays size={21} />
          </div>
          <div>
            <h2 className="text-lg font-black">Streak</h2>
            <p className="mt-0.5 text-sm font-bold text-muted">{chart.currentStreak} day streak</p>
          </div>
        </div>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink"
          onClick={() => setIsExpanded((value) => !value)}
          aria-label={isExpanded ? "Hide full activity history" : "Show full activity history"}
        >
          <ChevronRight className={`transition ${isExpanded ? "rotate-90" : ""}`} size={22} />
        </button>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-2 rounded-full bg-berry p-1">
          {chart.currentWeek.map((day) => {
            const hasActivity = day.count > 0;
            return (
              <span
                key={day.date}
                aria-label={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
                className={`flex h-9 items-center justify-center rounded-full ${compactActivityColor(day.level, day.isFuture)}`}
                title={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
              >
                {hasActivity && <CheckCircle2 size={21} strokeWidth={3} className="text-cream" />}
                {!hasActivity && <span className="h-3 w-3 rounded-full bg-cream/15" />}
              </span>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2 text-center">
          {compactDayLabels.map((label, index) => {
            const day = chart.currentWeek[index];
            const isActive = Boolean(day && day.count > 0);
            return (
            <span key={`${label}-${index}`} className={`text-xs font-black ${isActive ? "text-leaf" : "text-muted"}`}>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {isExpanded && <FullActivityChart chart={chart} />}
    </div>
  );
}

function FullActivityChart({ chart }: { chart: ActivityChart }) {
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth;
    }
  }, [chart.weeks]);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div ref={scrollerRef} className="overflow-x-auto pb-2" aria-label="Daily activity over the last 53 weeks">
        <div className="grid w-max grid-cols-[32px_repeat(53,12px)] gap-x-[3px] gap-y-[3px]">
          <span />
          {chart.weeks.map((week) => (
            <span key={`${week.startDate}-label`} className="h-4 overflow-visible text-[10px] font-bold leading-4 text-muted">
              {week.monthLabel ?? ""}
            </span>
          ))}

          {dayLabels.map((label, dayIndex) => (
            <Fragment key={`row-${dayIndex}`}>
              <span className="h-3 pr-1 text-right text-[10px] font-bold leading-3 text-muted">{label}</span>
              {chart.weeks.map((week) => {
                const cell = week.days[dayIndex];
                return (
                  <span
                    key={cell.date}
                    aria-label={`${cell.date}: ${cell.count} activity point${cell.count === 1 ? "" : "s"}`}
                    className={`h-3 w-3 rounded-[3px] ${activityCellColor(cell.level, cell.isFuture)}`}
                    title={`${cell.date}: ${cell.count} activity point${cell.count === 1 ? "" : "s"}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScannerCard({
  barcode,
  error,
  isLoading,
  onBarcodeChange,
  onSubmit,
  onCameraScan,
}: {
  barcode: string;
  error: string | null;
  isLoading: boolean;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCameraScan: () => void;
}) {
  return (
    <div className="bento-card overflow-hidden">
      <div className="grid min-h-[190px] grid-cols-[1.05fr_0.95fr]">
        <div className="bg-leaf p-5 text-cream">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cream/85">Barcode</p>
          <h2 className="mt-3 text-2xl font-black leading-tight">Scan an ingredient label fast</h2>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-berry px-4 py-3 text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-cream/70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onCameraScan}
          >
            <Camera size={17} />
            Camera
          </button>
        </div>
        <div className="flex items-center justify-center bg-sky p-4">
          <div className="rounded-[26px] bg-cream/75 p-5 text-leaf shadow-soft">
            <Barcode size={76} strokeWidth={1.8} />
          </div>
        </div>
      </div>

      <form className="space-y-3 p-4" onSubmit={onSubmit}>
        <label className="text-xs font-black uppercase tracking-[0.2em] text-muted" htmlFor="barcode">
          UPC or EAN
        </label>
        <div className="flex gap-2">
          <input
            id="barcode"
            inputMode="numeric"
            className="min-w-0 flex-1 rounded-[8px] border border-line bg-cream px-4 py-3 text-base font-bold outline-none transition focus:border-leaf"
            placeholder="5449000000996"
            value={barcode}
            onChange={(event) => onBarcodeChange(event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[8px] bg-ink text-cream outline-none transition focus-visible:ring-2 focus-visible:ring-leaf/35 disabled:opacity-60"
            onMouseDown={(event) => event.preventDefault()}
            disabled={isLoading}
            aria-label="Search barcode"
          >
            {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-[8px] bg-oat px-3 py-2 text-sm font-semibold text-ink">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bento-card bg-oat p-4">
        <Apple className="mb-5 text-leaf" size={30} />
        <h2 className="text-lg font-black">Ingredient-first</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Scores focus on processing and ingredient quality.</p>
      </div>
      <div className="bento-card bg-cream p-4">
        <CheckCircle2 className="mb-5 text-coral" size={30} />
        <h2 className="text-lg font-black">Clear swaps</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Alternatives are curated by product category.</p>
      </div>
    </div>
  );
}

function ProductResult({
  product,
  score,
  alternatives,
}: {
  product: Product;
  score: QualityScore;
  alternatives: AlternativeProduct[];
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-4">
      <div className="bento-card p-4">
        <div className="flex gap-4">
          <ProductThumb imageUrl={product.imageUrl} name={product.name} large />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-leaf">{product.brand ?? "Open Food Facts"}</p>
            <h2 className="mt-2 line-clamp-2 text-xl font-black leading-tight">{product.name}</h2>
            <p className="mt-2 line-clamp-1 text-xs font-bold text-muted">{product.categoriesText ?? product.barcode}</p>
          </div>
          <ScoreBadge value={score.value} />
        </div>
      </div>

      <FlagSection title="Ingredient flags" flags={score.flags} emptyText="No major ingredient-quality flags found." />
      <FlagSection title="Positive signals" flags={score.positives} emptyText="No positive clean-label signals found yet." />

      <div className="space-y-3">
        <SectionTitle eyebrow="Curated" title="Cleaner alternatives" />
        <div className="grid gap-3">
          {alternatives.map((alternative) => (
            <div key={alternative.id} className="bento-card flex items-start gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-oat text-leaf">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{alternative.category}</p>
                <h3 className="mt-1 text-base font-black">
                  {alternative.brand ? `${alternative.brand} ` : ""}
                  {alternative.name}
                </h3>
                <p className="mt-1 text-sm leading-5 text-muted">{alternative.reason}</p>
                <p className="mt-2 text-xs font-black text-leaf">{alternative.scoreHint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function FlagSection({ title, flags, emptyText }: { title: string; flags: IngredientFlag[]; emptyText: string }) {
  return (
    <div className="space-y-3">
      <SectionTitle eyebrow="Score" title={title} />
      <div className="grid gap-2">
        {flags.length > 0 ? (
          flags.map((flag) => (
            <div key={flag.id} className="bento-card flex items-start gap-3 p-3">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${flagColor(flag.severity)}`} />
              <div>
                <h3 className="text-sm font-black">{flag.label}</h3>
                <p className="mt-1 text-sm leading-5 text-muted">{flag.description}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="bento-card p-4 text-sm font-semibold text-muted">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-leaf">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
    </div>
  );
}

function ProductThumb({ imageUrl, name, large = false }: { imageUrl?: string; name: string; large?: boolean }) {
  const sizeClass = large ? "h-20 w-20" : "h-14 w-14";

  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-oat`}>
      {imageUrl ? <img className="h-full w-full object-contain" src={imageUrl} alt={name} /> : <Apple className="text-leaf" size={large ? 34 : 24} />}
    </div>
  );
}

function ScoreBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const className =
    size === "sm"
      ? "h-10 w-10 text-sm"
      : "h-14 w-14 text-lg";

  return (
    <div className={`${className} flex shrink-0 self-center items-center justify-center rounded-full font-black ${scoreTextColor(value)} ${scoreColor(value)}`}>
      {value}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      data-testid={testId}
      className={`flex flex-col items-center gap-1 rounded-[8px] py-1 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-leaf/35 ${active ? "text-leaf" : "text-muted"}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-leaf text-cream" : "bg-transparent"}`}>{icon}</span>
      {label}
    </button>
  );
}

function scoreColor(value: number): string {
  if (value <= 2) return "bg-[#df2f46]";
  if (value <= 3) return "bg-[#f17955]";
  if (value <= 5) return "bg-[#f4b65b]";
  if (value <= 6) return "bg-[#f7dc62]";
  if (value <= 8) return "bg-[#b7e55f]";
  return "bg-[#73c84d]";
}

function scoreTextColor(value: number): string {
  if (value <= 2) return "text-white";
  return "text-ink";
}

function flagColor(severity: IngredientFlag["severity"]): string {
  if (severity === "high") return "bg-berry";
  if (severity === "medium") return "bg-coral";
  if (severity === "positive") return "bg-leaf";
  if (severity === "info") return "bg-sky";
  return "bg-muted";
}

function activityCellColor(level: number, isFuture: boolean): string {
  if (isFuture) return "bg-cream";
  if (level <= 0) return "bg-berry";
  if (level === 1) return "bg-[#174f18]";
  if (level === 2) return "bg-leaf";
  if (level === 3) return "bg-[#4d873f]";
  return "bg-sky";
}

function compactActivityColor(level: number, isFuture: boolean): string {
  if (isFuture) return "bg-cream/20";
  if (level <= 0) return "bg-berry";
  if (level === 1) return "bg-[#174f18]";
  if (level === 2) return "bg-leaf";
  if (level === 3) return "bg-[#4d873f]";
  return "bg-sky";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function recordLoginActivityOnce(): ActivityDay[] | null {
  if (didRecordLoginThisRuntime) {
    return null;
  }

  try {
    if (sessionStorage.getItem(LOGIN_ACTIVITY_SESSION_KEY)) {
      didRecordLoginThisRuntime = true;
      return null;
    }

    sessionStorage.setItem(LOGIN_ACTIVITY_SESSION_KEY, "true");
  } catch {
    // Session storage is only a guard against duplicate launch points.
  }

  didRecordLoginThisRuntime = true;
  return recordActivity("login");
}
