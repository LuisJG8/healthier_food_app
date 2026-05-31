import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Apple,
  Barcode,
  Camera,
  CheckCircle2,
  ChevronRight,
  History,
  Home,
  Loader2,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { getAlternatives } from "./lib/alternatives";
import { getBarcodeError, normalizeBarcode } from "./lib/barcode";
import { fetchProductByBarcode } from "./lib/openFoodFacts";
import { scoreProduct } from "./lib/qualityScore";
import { getBarcodeScannerFormats } from "./lib/scannerFormats";
import { loadScanHistory, loadSettings, saveSettings, upsertScanHistory } from "./lib/storage";
import type { AlternativeProduct, AppSettings, IngredientFlag, Product, QualityScore, ScanHistoryItem } from "./types";

type Tab = "scan" | "history" | "profile";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ strictSeedOilPenalty: true });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qualityScore = useMemo(() => (product ? scoreProduct(product, settings) : null), [product, settings]);
  const alternatives = useMemo(() => (product ? getAlternatives(product) : []), [product]);

  useEffect(() => {
    setHistory(loadScanHistory());
    setSettings(loadSettings());
  }, []);

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
      setBarcode(normalized);
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

  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#fbfeff] shadow-soft md:my-6 md:min-h-[900px] md:overflow-hidden md:rounded-[34px]">
        <section className="flex-1 overflow-y-auto px-5 pb-28 pt-safe-offset">
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
                  <ProductResult product={product} score={qualityScore} alternatives={alternatives} />
                ) : (
                  <EmptyState />
                )}
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
                <SectionTitle eyebrow="Local" title="Scan history" />
                {history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <button
                        key={`${item.barcode}-${item.scannedAt}`}
                        className="bento-card flex w-full items-center gap-3 p-3 text-left"
                        onClick={() => void handleLookup(item.barcode)}
                      >
                        <ProductThumb imageUrl={item.imageUrl} name={item.productName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">{item.productName}</p>
                          <p className="truncate text-xs text-muted">{item.brand ?? item.barcode}</p>
                        </div>
                        <ScoreBadge value={item.score} size="sm" />
                        <ChevronRight size={17} className="text-muted" />
                      </button>
                    ))}
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
                        className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${
                          settings.strictSeedOilPenalty ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="bento-card bg-berry p-5 text-white">
                  <Sparkles className="mb-4 text-sky" size={28} />
                  <h2 className="text-lg font-black">MVP disclaimer</h2>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Scores are ingredient-quality guidance, not medical advice. Always review the product label,
                    especially for allergies and dietary needs.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[430px] border-t border-line bg-[#fbfeff]/95 px-7 pb-safe-offset pt-2 backdrop-blur md:absolute">
          <div className="grid grid-cols-3">
            <NavButton
              testId="nav-scan"
              active={activeTab === "scan"}
              icon={<Home size={21} />}
              label="Scan"
              onClick={() => setActiveTab("scan")}
            />
            <NavButton
              testId="nav-profile"
              active={activeTab === "profile"}
              icon={<User size={21} />}
              label="Profile"
              onClick={() => setActiveTab("profile")}
            />
            <NavButton
              testId="nav-history"
              active={activeTab === "history"}
              icon={<History size={21} />}
              label="History"
              onClick={() => setActiveTab("history")}
            />
          </div>
        </nav>
      </div>
    </main>
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
        <div className="bg-leaf p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/85">Barcode</p>
          <h2 className="mt-3 text-2xl font-black leading-tight">Scan an ingredient label fast</h2>
          <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-berry px-4 py-3 text-sm font-black" onClick={onCameraScan}>
            <Camera size={17} />
            Camera
          </button>
        </div>
        <div className="flex items-center justify-center bg-sky p-4">
          <div className="rounded-[26px] bg-white/75 p-5 text-leaf shadow-soft">
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
            className="min-w-0 flex-1 rounded-[8px] border border-line bg-white px-4 py-3 text-base font-bold outline-none transition focus:border-leaf"
            placeholder="5449000000996"
            value={barcode}
            onChange={(event) => onBarcodeChange(event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[8px] bg-ink text-white disabled:opacity-60"
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
      <div className="bento-card bg-white p-4">
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
      className={`flex flex-col items-center gap-1 text-xs font-black ${active ? "text-leaf" : "text-muted"}`}
      onClick={onClick}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-leaf text-white" : "bg-transparent"}`}>{icon}</span>
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

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}
