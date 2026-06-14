import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Apple,
  Barcode,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock,
  Database,
  FileText,
  History,
  LayoutGrid,
  Leaf,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Fragment, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import boulderCanyonChips from "./assets/boulder-canyon-chips.avif";
import burgerKingFries from "./assets/burger-king-fries.jpg";
import profilePhoto from "./assets/luis-gonzalez-profile.jpeg";
import { OnboardingFlow, type OnboardingStep } from "./components/OnboardingFlow";
import { SearchScreen } from "./components/SearchScreen";
import { getAlternatives } from "./lib/alternatives";
import { buildActivityChart, formatActivityWeekRange, type ActivityChart } from "./lib/activityChart";
import { getBarcodeError, normalizeBarcode } from "./lib/barcode";
import { createBrowserBarcodeDetector, isBrowserCameraPreviewSupported } from "./lib/browserBarcodeScanner";
import { fetchProductByBarcode } from "./lib/openFoodFacts";
import { scoreProduct } from "./lib/qualityScore";
import { getBarcodeScannerFormats } from "./lib/scannerFormats";
import {
  loadActivityDays,
  loadOnboardingProfile,
  loadScanHistory,
  loadSettings,
  recordActivity,
  saveOnboardingProfile,
  saveSettings,
  upsertScanHistory,
} from "./lib/storage";
import {
  acceptSwap,
  alternativeAt,
  clearAcceptedSwap,
  rejectSwapIndex,
  shouldReplaceAcceptedSwap,
  type AcceptedSwapIds,
  type SwapAlternativeIndexes,
} from "./lib/swapState";
import type {
  ActivityDay,
  AlternativeProduct,
  AppSettings,
  DietPreference,
  FoodAvoidance,
  IngredientFlag,
  MainGoal,
  OnboardingProfile,
  Product,
  QualityScore,
  ScanHistoryItem,
  SwapStrictness,
} from "./types";

type Tab = "home" | "search" | "scan" | "history" | "profile";
type VisibleOnboardingStep = Exclude<OnboardingStep, "app">;
type HistoryFilter = "all" | "saved" | "this-week";
type ScanCameraMode = "barcode" | "food";
type SwapDetailSide = "original" | "alternative";
type SwapDetail = {
  barcode: string;
  side: SwapDetailSide;
};
type AcceptedSwapPhase = "idle" | "confetti" | "rotate" | "replace" | "focus" | "settled";
type SwapCelebrationIds = Record<string, string>;
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
const ONBOARDING_SEQUENCE: VisibleOnboardingStep[] = ["welcome", "benefits", "scan-swap", "main-goal", "diet", "avoid", "strictness", "account"];
const ACCEPT_CONFETTI_MS = 1050;
const ACCEPT_ROTATE_MS = 420;
const ACCEPT_REPLACE_MS = 560;
const ACCEPT_FOCUS_MS = 440;

function createEmptyOnboardingProfile(): OnboardingProfile {
  return {
    mainGoals: [],
    dietPreferences: [],
    foodsToAvoid: [],
    swapStrictness: [],
    completed: false,
  };
}

function canContinueOnboardingStep(step: OnboardingStep, profile: OnboardingProfile): boolean {
  switch (step) {
    case "welcome":
    case "benefits":
    case "scan-swap":
      return true;
    case "main-goal":
      return profile.mainGoals.length > 0;
    case "diet":
      return profile.dietPreferences.length > 0;
    case "avoid":
      return profile.foodsToAvoid.length > 0;
    case "strictness":
      return profile.swapStrictness.length > 0;
    case "account":
      return isOnboardingProfileReady(profile);
    case "app":
      return false;
  }
}

function isOnboardingProfileReady(profile: OnboardingProfile): boolean {
  return Boolean(profile.mainGoals.length && profile.dietPreferences.length && profile.foodsToAvoid.length && profile.swapStrictness.length);
}

function toggleMultiSelect<T extends string>(currentValues: T[], value: T, exclusiveValue?: T): T[] {
  if (currentValues.includes(value)) {
    return currentValues.filter((item) => item !== value);
  }

  if (exclusiveValue && value === exclusiveValue) {
    return [value];
  }

  const nextValues = exclusiveValue ? currentValues.filter((item) => item !== exclusiveValue) : currentValues;
  return [...nextValues, value];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile>(() => loadOnboardingProfile());
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(() => (loadOnboardingProfile().completed ? "app" : "welcome"));
  const [barcode, setBarcode] = useState(TEST_BARCODE);
  const [product, setProduct] = useState<Product | null>(null);
  const [swapProducts, setSwapProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ strictSeedOilPenalty: true });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanEntry, setShowScanEntry] = useState(false);
  const [showBrowserScanner, setShowBrowserScanner] = useState(false);
  const [browserCameraStream, setBrowserCameraStream] = useState<MediaStream | null>(null);
  const [browserCameraError, setBrowserCameraError] = useState<string | null>(null);
  const [browserCameraStatus, setBrowserCameraStatus] = useState("Starting your laptop camera...");
  const [scanCameraMode, setScanCameraMode] = useState<ScanCameraMode>("barcode");
  const [swapDetail, setSwapDetail] = useState<SwapDetail | null>(null);
  const [swapAlternativeIndexes, setSwapAlternativeIndexes] = useState<SwapAlternativeIndexes>({});
  const [acceptedSwapIds, setAcceptedSwapIds] = useState<AcceptedSwapIds>({});
  const [settledAcceptedSwapIds, setSettledAcceptedSwapIds] = useState<AcceptedSwapIds>({});
  const [swapCelebrationIds, setSwapCelebrationIds] = useState<SwapCelebrationIds>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ScanHistoryItem | null>(null);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<Product | null>(null);
  const [selectedHistoryScore, setSelectedHistoryScore] = useState<QualityScore | null>(null);
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);
  const [isHistoryDetailLoading, setIsHistoryDetailLoading] = useState(false);
  const scanResultRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLElement>(null);
  const historyDetailRequestRef = useRef(0);
  const browserCameraStreamRef = useRef<MediaStream | null>(null);
  const browserCameraRequestRef = useRef(0);

  const qualityScore = useMemo(() => (product ? scoreProduct(product, settings) : null), [product, settings]);
  const alternatives = useMemo(() => (product ? getAlternatives(product) : []), [product]);
  const scanSwapProducts = useMemo(
    () => (product ? [product, ...swapProducts.filter((entry) => entry.barcode !== product.barcode)] : swapProducts),
    [product, swapProducts],
  );
  const activityChart = useMemo(() => buildActivityChart(activityDays), [activityDays]);

  useEffect(() => {
    setHistory(loadScanHistory());
    setSettings(loadSettings());
    setActivityDays(loadActivityDays());
  }, []);

  useEffect(() => {
    return () => {
      stopMediaStream(browserCameraStreamRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "scan" || !product) {
      return;
    }

    scrollScanResultIntoView();
  }, [activeTab, product]);

  useEffect(() => {
    if (activeTab !== "scan") {
      handleBrowserScannerClose();
    }
  }, [activeTab]);

  useEffect(() => {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0 });
    });
  }, [activeTab, selectedHistoryItem]);

  const handleAcceptedSwapSettled = useCallback((product: Product, alternative: AlternativeProduct) => {
    setSettledAcceptedSwapIds((existing) => acceptSwap(existing, product.barcode, alternative));
  }, []);

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
      setError("Open the local dev URL in Chrome or Safari to test with your laptop camera, or type the barcode below.");
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
        windowed: false,
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

  function startScanSession() {
    setShowScanEntry(true);
    setError(null);
    setScanCameraMode("barcode");

    if (canUseLaptopCameraPreview()) {
      void startBrowserCameraScanner();
      return;
    }

    setShowBrowserScanner(false);

    if (isTauriRuntime()) {
      void handleScanWithCamera();
      return;
    }

    setError("Camera preview needs browser camera access. Type the barcode below if camera scanning is unavailable.");
  }

  function handleScanFoodPress() {
    startScanSession();
  }

  function handleScanTabPress() {
    handleTabChange("scan");
    startScanSession();
  }

  function stopBrowserCameraStream() {
    browserCameraRequestRef.current += 1;
    stopMediaStream(browserCameraStreamRef.current);
    browserCameraStreamRef.current = null;
    setBrowserCameraStream(null);
  }

  async function startBrowserCameraScanner() {
    const requestId = browserCameraRequestRef.current + 1;
    browserCameraRequestRef.current = requestId;

    stopMediaStream(browserCameraStreamRef.current);
    browserCameraStreamRef.current = null;
    setBrowserCameraStream(null);
    setBrowserCameraError(null);
    setBrowserCameraStatus("Starting your laptop camera...");
    setShowBrowserScanner(true);

    try {
      const permissionState = await getBrowserCameraPermissionState();

      if (browserCameraRequestRef.current !== requestId) {
        return;
      }

      if (permissionState === "denied") {
        setBrowserCameraError(getBrowserCameraBlockedMessage());
        setBrowserCameraStatus("Camera permission is blocked.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (browserCameraRequestRef.current !== requestId) {
        stopMediaStream(stream);
        return;
      }

      browserCameraStreamRef.current = stream;
      setBrowserCameraStream(stream);
      setBrowserCameraStatus("Camera preview is active.");
    } catch (cameraError) {
      if (browserCameraRequestRef.current !== requestId) {
        return;
      }

      setBrowserCameraError(getBrowserCameraErrorMessage(cameraError));
      setBrowserCameraStatus("Camera access did not start.");
    }
  }

  function handleBrowserScannerClose() {
    stopBrowserCameraStream();
    setShowBrowserScanner(false);
    setBrowserCameraError(null);
    setBrowserCameraStatus("Starting your laptop camera...");
  }

  function handleBrowserScannerCloseToHome() {
    handleBrowserScannerClose();
    handleTabChange("home");
  }

  function handleBrowserBarcodeDetected(scannedBarcode: string) {
    stopBrowserCameraStream();
    setShowBrowserScanner(false);
    setShowScanEntry(true);
    setBarcode(scannedBarcode);
    void handleLookup(scannedBarcode);
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

    if (nextTab !== "scan") {
      setSwapDetail(null);
      setSwapCelebrationIds({});
    }

    if (nextTab !== "history") {
      clearHistoryDetail();
    }

    setActiveTab(nextTab);
  }

  function handleOnboardingBack() {
    if (onboardingStep === "app") {
      return;
    }

    const currentIndex = ONBOARDING_SEQUENCE.indexOf(onboardingStep);
    if (currentIndex <= 0) {
      return;
    }

    setOnboardingStep(ONBOARDING_SEQUENCE[currentIndex - 1]);
  }

  function handleOnboardingContinue() {
    if (onboardingStep === "app" || !canContinueOnboardingStep(onboardingStep, onboardingProfile)) {
      return;
    }

    if (onboardingStep === "account") {
      const completedProfile = saveOnboardingProfile({ ...onboardingProfile, completed: true });
      const loginActivity = recordLoginActivityOnce();
      setOnboardingProfile(completedProfile);
      if (loginActivity) {
        setActivityDays(loginActivity);
      }
      setOnboardingStep("app");
      setActiveTab("scan");
      startScanSession();
      window.scrollTo({ top: 0, left: 0 });
      return;
    }

    const currentIndex = ONBOARDING_SEQUENCE.indexOf(onboardingStep);
    const nextStep = ONBOARDING_SEQUENCE[currentIndex + 1];
    setOnboardingProfile(saveOnboardingProfile({ ...onboardingProfile, completed: false }));
    if (nextStep) {
      setOnboardingStep(nextStep);
    }
  }

  function handleMainGoalToggle(goal: MainGoal) {
    updateOnboardingProfile((current) => ({
      ...current,
      mainGoals: toggleMultiSelect(current.mainGoals, goal),
    }));
  }

  function handleDietPreferenceToggle(preference: DietPreference) {
    updateOnboardingProfile((current) => ({
      ...current,
      dietPreferences: toggleMultiSelect(current.dietPreferences, preference, "no-preference"),
    }));
  }

  function handleFoodAvoidanceToggle(avoidance: FoodAvoidance) {
    updateOnboardingProfile((current) => ({
      ...current,
      foodsToAvoid: toggleMultiSelect(current.foodsToAvoid, avoidance, "none"),
    }));
  }

  function handleSwapStrictnessToggle(strictness: SwapStrictness) {
    updateOnboardingProfile((current) => ({
      ...current,
      swapStrictness: toggleMultiSelect(current.swapStrictness, strictness),
    }));
  }

  function updateOnboardingProfile(updater: (current: OnboardingProfile) => OnboardingProfile) {
    setOnboardingProfile((current) => saveOnboardingProfile({ ...updater(current), completed: false }));
  }

  function handleAlternativeAccept(product: Product, alternative: AlternativeProduct) {
    setAcceptedSwapIds((existing) => acceptSwap(existing, product.barcode, alternative));
    setSettledAcceptedSwapIds((existing) => clearAcceptedSwap(existing, product.barcode));
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

    setSwapAlternativeIndexes((existing) => rejectSwapIndex(existing, product.barcode, nextAlternatives.length));
    setAcceptedSwapIds((existing) => clearAcceptedSwap(existing, product.barcode));
    setSettledAcceptedSwapIds((existing) => clearAcceptedSwap(existing, product.barcode));
  }

  async function handleHistoryItemSelect(item: ScanHistoryItem) {
    const requestId = historyDetailRequestRef.current + 1;
    historyDetailRequestRef.current = requestId;

    setSelectedHistoryItem(item);
    setSelectedHistoryProduct(null);
    setSelectedHistoryScore(null);
    setHistoryDetailError(null);
    setIsHistoryDetailLoading(true);

    try {
      const nextProduct = await fetchProductByBarcode(item.barcode);
      if (historyDetailRequestRef.current !== requestId) {
        return;
      }

      setSelectedHistoryProduct(nextProduct);
      setSelectedHistoryScore(scoreProduct(nextProduct, settings));
    } catch (detailError) {
      if (historyDetailRequestRef.current !== requestId) {
        return;
      }

      const message = detailError instanceof Error ? detailError.message : "Could not load full product details.";
      setHistoryDetailError(message);
    } finally {
      if (historyDetailRequestRef.current === requestId) {
        setIsHistoryDetailLoading(false);
      }
    }
  }

  function clearHistoryDetail() {
    historyDetailRequestRef.current += 1;
    setSelectedHistoryItem(null);
    setSelectedHistoryProduct(null);
    setSelectedHistoryScore(null);
    setHistoryDetailError(null);
    setIsHistoryDetailLoading(false);
  }

  if (onboardingStep !== "app") {
    return (
      <OnboardingFlow
        step={onboardingStep}
        profile={onboardingProfile}
        onBack={handleOnboardingBack}
        onContinue={handleOnboardingContinue}
        onMainGoalToggle={handleMainGoalToggle}
        onDietPreferenceToggle={handleDietPreferenceToggle}
        onFoodAvoidanceToggle={handleFoodAvoidanceToggle}
        onSwapStrictnessToggle={handleSwapStrictnessToggle}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] bg-cream text-ink">
      <div className="relative mx-auto flex h-[100dvh] min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-cream shadow-soft md:my-6 md:h-[900px] md:max-h-[calc(100vh-3rem)] md:rounded-[34px]">
        <section ref={contentScrollRef} className="app-scroll-area min-h-0 flex-1 px-5 pb-24 pt-safe-offset">
          <AnimatePresence mode="wait">
            {(activeTab === "home" || activeTab === "scan") && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                <DashboardScanScreen
                  mode={activeTab === "scan" ? "scan" : "home"}
                  barcode={barcode}
                  error={error}
                  isLoading={isLoading}
                  showBarcodeEntry={showScanEntry}
                  history={history}
                  streak={activityChart.currentStreak}
                  onBarcodeChange={setBarcode}
                  onSubmit={handleSubmit}
                />

                {activeTab === "scan" && product && qualityScore && (
                  <div ref={scanResultRef} className="mt-5">
                    <ProductResult product={product} score={qualityScore} alternatives={alternatives} showAlternatives={false} />
                    <div className="mt-5">
                      <SwapScreen
                        products={scanSwapProducts}
                        settings={settings}
                        detail={swapDetail}
                        alternativeIndexes={swapAlternativeIndexes}
                        acceptedSwapIds={acceptedSwapIds}
                        settledAcceptedSwapIds={settledAcceptedSwapIds}
                        celebrationIds={swapCelebrationIds}
                        onDetailChange={setSwapDetail}
                        onAlternativeAccept={handleAlternativeAccept}
                        onAlternativeReject={handleAlternativeReject}
                        onAcceptedSwapSettled={handleAcceptedSwapSettled}
                      />
                    </div>
                  </div>
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
                className="min-h-full"
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
                  <HistoryScreen
                    history={history}
                    filter={historyFilter}
                    onFilterChange={setHistoryFilter}
                    onItemSelect={(item) => void handleHistoryItemSelect(item)}
                  />
                )}
              </motion.div>
            )}

            {activeTab === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                <SearchScreen />
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="min-h-full"
              >
                <ProfileScreen
                  chart={activityChart}
                  onLogOut={() => {
                    const nextProfile = createEmptyOnboardingProfile();
                    setOnboardingProfile(saveOnboardingProfile(nextProfile));
                    setOnboardingStep("welcome");
                    setActiveTab("scan");
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <nav className="shrink-0 border-t border-line bg-white/92 px-4 pb-safe-offset pt-2 shadow-[0_-12px_30px_rgba(0,105,107,0.08)] backdrop-blur">
          <div className="grid grid-cols-5">
            <NavButton
              testId="nav-home"
              active={activeTab === "home"}
              icon={<LayoutGrid size={21} />}
              label="Home"
              onClick={() => handleTabChange("home")}
            />
            <NavButton
              testId="nav-search"
              active={activeTab === "search"}
              icon={<Search size={21} />}
              label="Search"
              onClick={() => handleTabChange("search")}
            />
            <NavButton
              testId="nav-scan"
              active={activeTab === "scan"}
              icon={<Camera size={21} />}
              label="Scan"
              onClick={handleScanTabPress}
            />
            <NavButton
              testId="nav-history"
              active={activeTab === "history"}
              icon={<History size={21} />}
              label="History"
              onClick={() => handleTabChange("history")}
            />
            <NavButton
              testId="nav-profile"
              active={activeTab === "profile"}
              icon={<Settings size={21} />}
              label="Profile"
              onClick={() => handleTabChange("profile")}
            />
          </div>
        </nav>

        {showBrowserScanner && (
          <BrowserScannerPanel
            mode={scanCameraMode}
            stream={browserCameraStream}
            status={browserCameraStatus}
            error={browserCameraError}
            onModeChange={setScanCameraMode}
            onClose={handleBrowserScannerCloseToHome}
            onDetected={handleBrowserBarcodeDetected}
            onRetry={() => void startBrowserCameraScanner()}
          />
        )}
      </div>
    </main>
  );
}

function DashboardScanScreen({
  mode,
  barcode,
  error,
  isLoading,
  showBarcodeEntry,
  history,
  streak,
  onBarcodeChange,
  onSubmit,
}: {
  mode: "home" | "scan";
  barcode: string;
  error: string | null;
  isLoading: boolean;
  showBarcodeEntry: boolean;
  history: ScanHistoryItem[];
  streak: number;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isScanMode = mode === "scan";
  const recommendations = [
    {
      name: "Organic Green Juice",
      detail: "High in antioxidants",
      score: "9.5",
      art: "juice" as const,
    },
    {
      name: "Nutra Harvest Bar",
      detail: "Fiber & Protein Rich",
      score: "8.2",
      art: "bar" as const,
    },
  ];
  const streakLabel = `${Math.max(streak, 5)} Days`;
  const introTitle = isScanMode ? "Scan a barcode" : "Hello, Alex!";
  const introCopy = isScanMode
    ? "Point your package barcode at the camera to see cleaner swaps."
    : "Ready to make healthy choices today?";

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-6">
      <section className="px-5 pt-5">
        <h2 className="text-[28px] font-black leading-9 text-[#191C1D]">{introTitle}</h2>
        <p className="mt-0.5 text-[16px] font-medium leading-6 text-[#3B4949]">{introCopy}</p>
      </section>

      {!isScanMode && (
        <section className="pt-9">
          <div className="mb-3 flex items-end justify-between px-5">
            <h2 className="text-[24px] font-black leading-8 text-[#191C1D]">Recommended for You</h2>
            <button className="pb-1 text-[14px] font-bold text-[#00696B] transition hover:text-[#004F51]" type="button">
              View all
            </button>
          </div>
          <div className="flex gap-6 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recommendations.map((item) => (
              <RecommendedFoodCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      )}

      {(showBarcodeEntry || error) && (
        <DashboardLookupPanel
          barcode={barcode}
          error={error}
          isLoading={isLoading}
          onBarcodeChange={onBarcodeChange}
          onSubmit={onSubmit}
        />
      )}

      {!isScanMode && (
        <section className="grid grid-cols-2 gap-3 px-5 pt-10">
          <DashboardStatCard icon={<Clock size={25} />} label="Last Scan" value={formatLastScanSummary(history)} tone="blue" />
          <DashboardStatCard icon={<Leaf size={26} />} label="Health Streak" value={streakLabel} tone="green" />
        </section>
      )}
    </div>
  );
}

function BrowserScannerPanel({
  mode,
  stream,
  status,
  error,
  onModeChange,
  onClose,
  onDetected,
  onRetry,
}: {
  mode: ScanCameraMode;
  stream: MediaStream | null;
  status: string;
  error: string | null;
  onModeChange: (mode: ScanCameraMode) => void;
  onClose: () => void;
  onDetected: (value: string) => void;
  onRetry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTimerRef = useRef(0);
  const isDetectingRef = useRef(false);
  const requestIdRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopDetection = useCallback(() => {
    window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = 0;
    isDetectingRef.current = false;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    stopDetection();
    setLocalError(null);

    if (!stream) {
      return () => {
        requestIdRef.current += 1;
        stopDetection();
      };
    }

    const video = videoRef.current;
    if (!video) {
      return () => {
        requestIdRef.current += 1;
        stopDetection();
      };
    }

    video.srcObject = stream;

    const detector = mode === "barcode" ? createBrowserBarcodeDetector() : null;

    if (mode === "barcode" && !detector) {
      setLocalError("Camera preview is on, but this browser does not expose barcode detection. Try Chrome or Safari with camera permissions enabled.");
    }

    const scanLoop = async () => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      if (isDetectingRef.current) {
        scanTimerRef.current = window.setTimeout(scanLoop, 180);
        return;
      }

      if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scanTimerRef.current = window.setTimeout(scanLoop, 180);
        return;
      }

      isDetectingRef.current = true;

      try {
        if (!detector) {
          return;
        }

        const detections = await detector.detect(videoRef.current);
        const match = detections.find((item) => item.rawValue?.trim());

        if (match?.rawValue) {
          requestIdRef.current += 1;
          stopDetection();
          onDetectedRef.current(match.rawValue.trim());
          return;
        }
      } catch (detectError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setLocalError(getBrowserCameraErrorMessage(detectError));
        stopDetection();
        return;
      } finally {
        isDetectingRef.current = false;
      }

      scanTimerRef.current = window.setTimeout(scanLoop, 180);
    };

    void video.play().then(
      () => {
        if (requestIdRef.current === requestId) {
          if (mode === "barcode" && detector) {
            scanTimerRef.current = window.setTimeout(scanLoop, 180);
          }
        }
      },
      (playError: unknown) => {
        if (requestIdRef.current === requestId) {
          setLocalError(getBrowserCameraErrorMessage(playError));
          stopDetection();
        }
      },
    );

    return () => {
      requestIdRef.current += 1;
      stopDetection();
    };
  }, [mode, stopDetection, stream]);

  const displayError = error ?? localError;
  const isBarcodeMode = mode === "barcode";
  const panelTitle = isBarcodeMode ? "Scan a barcode" : "Scan food";
  const panelCopy = isBarcodeMode ? "Point the package barcode inside the frame." : "Center the food in the camera preview.";

  return (
    <section
      className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={panelTitle}
    >
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" autoPlay muted playsInline />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.64)_0%,rgba(0,0,0,0.18)_40%,rgba(0,0,0,0.74)_100%)]" />

      <header className="relative z-10 flex flex-col items-start px-5 pt-[calc(env(safe-area-inset-top)+18px)]">
        <button
          className="shrink-0 rounded-full border border-white/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
        <div className="mt-5 min-w-0">
          <h2 className="text-[25px] font-black leading-8">{panelTitle}</h2>
          <p className="mt-1 max-w-[260px] text-[14px] font-semibold leading-5 text-white/78">{panelCopy}</p>
          <div className="mt-4 inline-flex rounded-full border border-white/18 bg-black/34 p-1 shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-md">
            <ScanModeButton active={isBarcodeMode} label="Barcode scan" onClick={() => onModeChange("barcode")} />
            <ScanModeButton active={!isBarcodeMode} label="Scan food" onClick={() => onModeChange("food")} />
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
        {isBarcodeMode && (
          <div
            className="h-[132px] w-[min(82vw,340px)] rounded-[24px] border-[3px] border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
            aria-hidden="true"
          />
        )}
      </div>

      {displayError && (
        <div className="relative z-10 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <div className="rounded-[14px] bg-[#FFD9D4] px-3 py-2 text-sm font-semibold text-[#7A1F13] shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{displayError}</span>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#8A1F15] px-4 text-sm font-black text-white transition hover:bg-[#6F170F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A1F15]/35"
              onClick={onRetry}
            >
              Try camera again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ScanModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`h-10 rounded-full px-4 text-[12px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active ? "bg-white text-[#063F41] shadow-[0_8px_20px_rgba(0,0,0,0.24)]" : "text-white/74 hover:bg-white/10 hover:text-white"
      }`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function RecommendedFoodCard({
  item,
}: {
  item: {
    name: string;
    detail: string;
    score: string;
    art: "juice" | "bar";
  };
}) {
  return (
    <button
      type="button"
      className="w-64 shrink-0 overflow-hidden rounded-xl border border-[#DDE8E9] bg-white text-left shadow-[0_4px_18px_rgba(0,105,107,0.06)] transition active:scale-[0.98]"
    >
      <div className="relative flex h-44 items-end justify-center overflow-hidden bg-[linear-gradient(145deg,#FFFFFF_0%,#F2F7F6_100%)]">
        <ProductRecommendationArt kind={item.art} />
        <span className="absolute right-3 top-3 rounded-full bg-[#AEEED8] px-3 py-1 text-[12px] font-bold leading-4 text-[#316D5B]">
          {item.score}
        </span>
      </div>
      <div className="px-3 py-3">
        <h3 className="truncate text-[15px] font-semibold leading-5 text-[#191C1D]">{item.name}</h3>
        <p className="truncate text-[13px] font-medium leading-4 text-[#3B4949]">{item.detail}</p>
      </div>
    </button>
  );
}

function ProductRecommendationArt({ kind }: { kind: "juice" | "bar" }) {
  if (kind === "bar") {
    return (
      <div className="relative mb-12 h-24 w-44">
        <div className="absolute left-5 top-9 h-12 w-36 rotate-[-5deg] rounded-[6px] border border-[#D8E4DF] bg-white shadow-[0_18px_28px_rgba(0,0,0,0.10)]">
          <div className="absolute left-3 top-2 h-4 w-16 rounded-sm bg-[#E4F4EE]" />
          <div className="absolute bottom-2 left-3 h-3 w-20 rounded-sm bg-[#D7C9A8]" />
          <div className="absolute right-3 top-2 h-7 w-8 rounded bg-[#8BAF83]" />
        </div>
        <div className="absolute bottom-0 left-12 h-5 w-28 rounded-full bg-[#C7D5D5]/35 blur-md" />
      </div>
    );
  }

  return (
    <div className="relative h-40 w-56">
      <div className="absolute bottom-5 left-7 h-8 w-8 rounded-full bg-[#6F9844]" />
      <div className="absolute bottom-5 left-14 h-7 w-10 rounded-full bg-[#C7DB7E]" />
      <div className="absolute bottom-4 right-9 h-7 w-7 rounded-full bg-[#8B6A3E]" />
      <div className="absolute bottom-7 right-16 h-5 w-8 rounded-full bg-[#AFC76B]" />
      <div className="absolute bottom-5 left-1 h-12 w-14 rounded-[50%] border-t-[10px] border-[#3F8C57]" />
      <div className="absolute bottom-5 left-[86px] h-[116px] w-[48px] rounded-b-[12px] rounded-t-[15px] bg-gradient-to-b from-[#597F30] to-[#0F5534] shadow-[0_18px_24px_rgba(0,85,52,0.22)]">
        <div className="mx-auto mt-7 h-8 w-7 rounded-sm bg-white/85 text-center text-[4px] font-black uppercase leading-3 text-[#3D6B33]">
          Organic
        </div>
        <div className="absolute left-3 top-[-14px] h-4 w-6 rounded-t-[5px] bg-[#5C7E34]" />
      </div>
      <div className="absolute bottom-2 left-8 h-7 w-40 rounded-full bg-[#C7D5D5]/35 blur-md" />
    </div>
  );
}

function DashboardLookupPanel({
  barcode,
  error,
  isLoading,
  onBarcodeChange,
  onSubmit,
}: {
  barcode: string;
  error: string | null;
  isLoading: boolean;
  onBarcodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="mx-5 mt-4 rounded-2xl border border-[#DDE8E9] bg-white/82 p-4 shadow-[0_8px_24px_rgba(0,105,107,0.08)] backdrop-blur" onSubmit={onSubmit}>
      <label className="text-[11px] font-black uppercase leading-4 tracking-[0.18em] text-[#00696B]" htmlFor="dashboard-barcode">
        UPC or EAN
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="dashboard-barcode"
          inputMode="numeric"
          className="min-w-0 flex-1 rounded-[14px] border border-[#D9E4E5] bg-[#F8FAFB] px-4 py-3 text-base font-bold text-[#1F2629] outline-none transition placeholder:text-[#667080] focus:border-[#00C5C8] focus:ring-2 focus:ring-[#00C5C8]/20"
          placeholder="5449000000996"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
        />
        <button
          type="submit"
          className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 disabled:opacity-60"
          disabled={isLoading}
          aria-label="Search barcode"
        >
          {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-[#DDF7EF] px-3 py-2 text-sm font-semibold text-[#00696B]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}

function DashboardStatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "blue" | "green" }) {
  const colors =
    tone === "blue"
      ? "border-[#8BC3CA]/45 bg-[#DFF1F4] text-[#2D666D]"
      : "border-[#AEEED8]/55 bg-[#E8F7F2] text-[#2C6956]";

  return (
    <div className={`min-h-[126px] rounded-2xl border p-6 ${colors}`}>
      <div className="mb-5">{icon}</div>
      <p className="text-[12px] font-bold leading-4">{label}</p>
      <p className="mt-0.5 text-[14px] font-black leading-5 text-[#191C1D]">{value}</p>
    </div>
  );
}

function formatLastScanSummary(history: ScanHistoryItem[]): string {
  const latest = history[0];
  if (!latest) {
    return "2 hours ago";
  }

  const timestamp = new Date(latest.scannedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? "Just now" : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function HistoryScreen({
  history,
  filter,
  onFilterChange,
  onItemSelect,
}: {
  history: ScanHistoryItem[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onItemSelect: (item: ScanHistoryItem) => void;
}) {
  const filteredHistory = filterHistoryItems(history, filter);

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-10">
      <div className="px-5 pb-2 pt-8">
        <h2 className="text-[32px] font-black leading-tight text-[#191C1D]">My Scans</h2>
        <p className="mt-1 text-[18px] font-medium leading-7 text-[#3B4949]">Review your nutritional history</p>
      </div>

      <div className="sticky top-0 z-10 border-b border-[#BAC9C9]/40 bg-[#F8FAFB]/90 px-5 pt-5 backdrop-blur">
        <div className="flex gap-12">
          <HistoryFilterButton active={filter === "all"} label="All" onClick={() => onFilterChange("all")} />
          <HistoryFilterButton active={filter === "saved"} label="Saved" onClick={() => onFilterChange("saved")} />
          <HistoryFilterButton active={filter === "this-week"} label="This Week" onClick={() => onFilterChange("this-week")} />
        </div>
      </div>

      <div className="space-y-4 px-5 pt-10">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item) => (
            <HistoryScanCard key={`${item.barcode}-${item.scannedAt}`} item={item} onSelect={() => onItemSelect(item)} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#DDF7EF] text-[#00696B]">
              <History size={34} />
            </div>
            <h3 className="mt-5 text-2xl font-black text-[#191C1D]">No scans yet</h3>
            <p className="mt-2 max-w-[280px] text-sm font-semibold leading-6 text-[#566164]">
              Start by scanning a food product to see your history and insights here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileScreen({ chart, onLogOut }: { chart: ActivityChart; onLogOut: () => void }) {
  const metrics = [
    { label: "Age", value: "28", suffix: "Years", tone: "text-[#00696B]" },
    { label: "Weight", value: "75kg", suffix: "Current", tone: "text-[#00696B]" },
    { label: "Height", value: "180cm", suffix: "Centimeters", tone: "text-[#00696B]" },
    { label: "Goal", value: "Bulking", suffix: "Active", tone: "text-[#2C6956]" },
  ];
  const settingsItems = [
    { label: "Notifications", icon: <Bell size={21} strokeWidth={1.9} />, danger: false },
    { label: "Privacy Policy", icon: <Shield size={21} strokeWidth={1.9} />, danger: false },
    { label: "Terms of Service", icon: <FileText size={21} strokeWidth={1.9} />, danger: false },
    { label: "Data & Storage", icon: <Database size={21} strokeWidth={1.9} />, danger: false },
  ];

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-8">
      <section className="flex flex-col items-center px-5 pt-5 text-center">
        <div className="relative">
          <div className="h-[120px] w-[120px] overflow-hidden rounded-full border-4 border-[#AEEED8] bg-white shadow-[0_16px_34px_rgba(0,105,107,0.10)]">
            <img className="h-full w-full object-cover" src={profilePhoto} alt="Luis Gonzalez" />
          </div>
          <button
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#00696B] text-white shadow-[0_10px_22px_rgba(0,105,107,0.24)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/45"
            type="button"
            aria-label="Edit avatar"
          >
            <Pencil size={15} strokeWidth={3} />
          </button>
        </div>
        <h2 className="mt-3 text-[24px] font-black leading-8 text-[#191C1D]">Alex Johnson</h2>
        <p className="text-[16px] font-medium leading-6 text-[#3B4949]">alex.j@example.com</p>
        <button
          className="mt-5 min-h-11 rounded-full border-2 border-[#00BFC3] px-8 text-[15px] font-semibold text-[#00696B] transition hover:bg-[#E8FDFD] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
          type="button"
        >
          Edit Profile
        </button>
      </section>

      <section className="px-5 pt-8">
        <h3 className="mb-3 text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Login Activity</h3>
        <ActivityCard chart={chart} />
      </section>

      <section className="px-5 pt-7">
        <h3 className="mb-3 text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Health Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex min-h-[116px] flex-col items-center justify-center rounded-xl border border-[#DDE8E9] bg-white/72 px-3 text-center shadow-[0_4px_20px_rgba(0,105,107,0.05)] backdrop-blur"
            >
              <p className="text-[12px] font-bold leading-4 text-[#3B4949]">{metric.label}</p>
              <p className={`mt-3 text-[25px] font-black leading-8 ${metric.tone}`}>{metric.value}</p>
              <p className="mt-2 text-[12px] font-bold leading-4 text-[#6B7A7A]">{metric.suffix}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pt-7">
        <h3 className="mb-3 text-[12px] font-black uppercase leading-4 tracking-[0.12em] text-[#2C6956]">Account Settings</h3>
        <div className="overflow-hidden rounded-xl border border-[#DDE8E9] bg-white/70 shadow-[0_4px_20px_rgba(0,105,107,0.05)] backdrop-blur">
          {settingsItems.map((item) => (
            <ProfileSettingsRow key={item.label} label={item.label} icon={item.icon} />
          ))}
          <ProfileSettingsRow label="Log Out" icon={<LogOut size={21} strokeWidth={1.9} />} danger onClick={onLogOut} />
        </div>
      </section>
    </div>
  );
}

function ProfileSettingsRow({
  label,
  icon,
  danger = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-[72px] w-full items-center justify-between border-b border-[#DDE8E9]/70 px-7 text-left transition last:border-b-0 hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00C5C8]/35 ${
        danger ? "text-[#BA1A1A] hover:bg-[#FFDAD6]/35" : "text-[#191C1D]"
      }`}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-5">
        <span className={danger ? "text-[#BA1A1A]" : "text-[#3B4949]"}>{icon}</span>
        <span className="truncate text-[16px] font-medium leading-6">{label}</span>
      </span>
      <ChevronRight className={danger ? "text-[#F0B8B8]" : "text-[#BAC9C9]"} size={22} strokeWidth={2.2} />
    </button>
  );
}

function HistoryFilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`relative pb-4 text-[16px] font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAFB] ${
        active ? "text-[#00696B]" : "text-[#273737] hover:text-[#00696B]"
      }`}
      onClick={onClick}
    >
      {label}
      {active && <span className="absolute bottom-[-2px] left-0 h-[3px] w-full rounded-full bg-[#00696B]" />}
    </button>
  );
}

function HistoryScanCard({ item, onSelect }: { item: ScanHistoryItem; onSelect: () => void }) {
  const tags = historyItemTags(item);

  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-xl border border-[#DDE8E9] bg-white/75 p-3 text-left shadow-[0_4px_20px_rgba(0,105,107,0.08)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <HistoryThumb imageUrl={item.imageUrl} name={item.productName} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[17px] font-semibold leading-6 text-black">{item.productName}</h3>
        <p className="truncate text-[14px] font-semibold leading-5 text-[#3B4949]">{formatCompactHistoryDateTime(item.scannedAt)}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag.label} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold leading-4 ${tag.className}`}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>
      <HistoryScoreRing score={item.score} />
    </button>
  );
}

function HistoryThumb({ imageUrl, name }: { imageUrl?: string; name: string }) {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#B1EFD8] to-[#00696B]/25">
      {imageUrl ? (
        <img className="h-full w-full object-cover" src={imageUrl} alt={name} />
      ) : (
        <Apple className="text-[#00696B]" size={34} strokeWidth={1.9} />
      )}
    </div>
  );
}

function HistoryScoreRing({ score }: { score: number }) {
  const displayScore = Math.min(10, Math.max(1, Math.round(score)));
  const progressScore = displayScore * 10;
  const accentColor = scoreAccentColor(displayScore);

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${accentColor} ${progressScore}%, #E1E3E4 ${progressScore}% 100%)` }}
      aria-label={`Score ${displayScore} out of 10`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F8FAFB] text-[16px] font-black" style={{ color: accentColor }}>
        {displayScore}
      </div>
    </div>
  );
}

function filterHistoryItems(history: ScanHistoryItem[], filter: HistoryFilter): ScanHistoryItem[] {
  if (filter === "saved") {
    return history.filter((item) => item.score >= 8);
  }

  if (filter === "this-week") {
    return history.filter((item) => isWithinCurrentWeek(item.scannedAt));
  }

  return history;
}

function isWithinCurrentWeek(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);

  return date >= start;
}

function formatCompactHistoryDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const itemDay = new Date(date);
  itemDay.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((today.getTime() - itemDay.getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);

  if (dayDiff === 0) {
    return `Today, ${time}`;
  }

  if (dayDiff === 1) {
    return `Yesterday, ${time}`;
  }

  return `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}, ${time}`;
}

function historyItemTags(item: ScanHistoryItem): Array<{ label: string; className: string }> {
  if (item.score >= 8) {
    return [
      { label: "High Score", className: "bg-[#AEEED8] text-[#0D503F]" },
      { label: "Safe", className: "bg-[#E1E3E4] text-[#3B4949]" },
    ];
  }

  if (item.score >= 6) {
    return [
      { label: "Review", className: "bg-[#B3ECF3] text-[#0D4E54]" },
      { label: "Moderate", className: "bg-[#E1E3E4] text-[#3B4949]" },
    ];
  }

  return [
    { label: "Flagged", className: "bg-[#FFDAD6] text-[#93000A]" },
    { label: "Check label", className: "bg-[#E1E3E4] text-[#3B4949]" },
  ];
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
  const ingredientPreview = ingredients.slice(0, 3);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [showAllNutritionData, setShowAllNutritionData] = useState(false);

  useEffect(() => {
    setShowAllIngredients(false);
    setShowAllNutritionData(false);
  }, [item.barcode]);

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

          <HistoryDetailSection
            title="Ingredients"
            action={
              <HistorySectionExpandButton
                expanded={showAllIngredients}
                onClick={() => setShowAllIngredients((value) => !value)}
                label={showAllIngredients ? "Hide full ingredient list" : "Show full ingredient list"}
              />
            }
          >
            {product.ingredientsText ? (
              <>
                <p className="text-sm font-semibold leading-5 text-muted">
                  {ingredients.length > 0 ? `${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"} available.` : "Ingredient text available."}
                </p>
                {!showAllIngredients && ingredientPreview.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ingredientPreview.map((ingredient) => (
                      <span key={ingredient} className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-black text-muted">
                        {ingredient}
                      </span>
                    ))}
                    {ingredients.length > ingredientPreview.length && (
                      <span className="rounded-full border border-line bg-oat px-3 py-1 text-xs font-black text-muted">
                        +{ingredients.length - ingredientPreview.length} more
                      </span>
                    )}
                  </div>
                )}
                {showAllIngredients && (
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

          <HistoryDetailSection
            title="Nutrition data"
            action={
              <HistorySectionExpandButton
                expanded={showAllNutritionData}
                onClick={() => setShowAllNutritionData((value) => !value)}
                label={showAllNutritionData ? "Hide full nutrition data" : "Show full nutrition data"}
              />
            }
          >
            {nutrimentRows.length > 0 ? (
              <>
                <p className="text-sm font-semibold leading-5 text-muted">
                  {nutrimentRows.length} nutrition field{nutrimentRows.length === 1 ? "" : "s"} available.
                </p>
                {showAllNutritionData && (
                  <div className="grid gap-2">
                    {nutrimentRows.map(([key, value]) => (
                      <HistoryDataRow key={key} label={formatDataKey(key)} value={formatDataValue(value)} />
                    ))}
                  </div>
                )}
              </>
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

function HistoryDetailSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bento-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function HistorySectionExpandButton({ expanded, onClick, label }: { expanded: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/35"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
    >
      <ChevronRight className={`transition-transform duration-300 ease-out ${expanded ? "rotate-90" : ""}`} size={22} />
    </button>
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

function productDataRows(data?: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(data ?? {}).sort(([left], [right]) => left.localeCompare(right));
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

function SwapScreen({
  products,
  settings,
  detail,
  alternativeIndexes,
  acceptedSwapIds,
  settledAcceptedSwapIds,
  celebrationIds,
  onDetailChange,
  onAlternativeAccept,
  onAlternativeReject,
  onAcceptedSwapSettled,
}: {
  products: Product[];
  settings: AppSettings;
  detail: SwapDetail | null;
  alternativeIndexes: SwapAlternativeIndexes;
  acceptedSwapIds: AcceptedSwapIds;
  settledAcceptedSwapIds: AcceptedSwapIds;
  celebrationIds: SwapCelebrationIds;
  onDetailChange: (detail: SwapDetail | null) => void;
  onAlternativeAccept: (product: Product, alternative: AlternativeProduct) => void;
  onAlternativeReject: (product: Product) => void;
  onAcceptedSwapSettled: (product: Product, alternative: AlternativeProduct) => void;
}) {
  const hasStarterDetail = detail?.barcode === "starter";
  const selectedProduct = detail ? products.find((entry) => entry.barcode === detail.barcode) ?? null : null;
  const selectedScore = selectedProduct ? scoreProduct(selectedProduct, settings) : null;
  const selectedAlternatives = selectedProduct ? getAlternatives(selectedProduct) : [];
  const selectedAlternativeIndex = selectedProduct ? alternativeIndexes[selectedProduct.barcode] ?? 0 : 0;
  const selectedAlternative = alternativeAt(selectedAlternatives, selectedAlternativeIndex, FALLBACK_SWAP);
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
                const entryAlternative = alternativeAt(entryAlternatives, entryAlternativeIndex, FALLBACK_SWAP);
                return (
                  <SwapComparisonCard
                    key={entry.barcode}
                    product={entry}
                    score={entryScore}
                    alternative={entryAlternative}
                    alternativeIndex={entryAlternativeIndex}
                    alternativeCount={entryAlternatives.length}
                    isAccepted={acceptedSwapIds[entry.barcode] === entryAlternative.id}
                    hasSettledAcceptedSwap={settledAcceptedSwapIds[entry.barcode] === entryAlternative.id}
                    isCelebrating={celebrationIds[entry.barcode] === entryAlternative.id}
                    onDetailChange={(side) => onDetailChange({ barcode: entry.barcode, side })}
                    onAlternativeAccept={() => onAlternativeAccept(entry, entryAlternative)}
                    onAlternativeReject={() => onAlternativeReject(entry)}
                    onAcceptedSwapSettled={onAcceptedSwapSettled}
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
  hasSettledAcceptedSwap = false,
  isCelebrating = false,
  onDetailChange,
  onAlternativeAccept,
  onAlternativeReject,
  onAcceptedSwapSettled,
}: {
  product: Product | null;
  score: QualityScore | null;
  alternative: AlternativeProduct;
  alternativeIndex?: number;
  alternativeCount?: number;
  isAccepted?: boolean;
  hasSettledAcceptedSwap?: boolean;
  isCelebrating?: boolean;
  onDetailChange: (side: SwapDetailSide) => void;
  onAlternativeAccept?: () => void;
  onAlternativeReject?: () => void;
  onAcceptedSwapSettled?: (product: Product, alternative: AlternativeProduct) => void;
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
  const shouldReplaceAccepted = Boolean(product && isAccepted && shouldReplaceAcceptedSwap(score?.value));
  const prefersReducedMotion = useReducedMotion();
  const [acceptedSwapPhase, setAcceptedSwapPhase] = useState<AcceptedSwapPhase>(() =>
    shouldReplaceAccepted && hasSettledAcceptedSwap ? "settled" : "idle",
  );
  const [replaceDelta, setReplaceDelta] = useState({ x: 0, y: 0 });
  const [focusDelta, setFocusDelta] = useState({ x: 0, y: 0 });
  const [settledPanelWidth, setSettledPanelWidth] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const originalPanelRef = useRef<HTMLDivElement>(null);
  const alternativePanelRef = useRef<HTMLDivElement>(null);
  const acceptedSwapKey = product ? `${product.barcode}-${alternative.id}` : "starter";
  const isReplacementSettled = shouldReplaceAccepted && acceptedSwapPhase === "settled";
  const isReplacementTransitioning =
    shouldReplaceAccepted && (acceptedSwapPhase === "replace" || acceptedSwapPhase === "focus");
  const isReplacementFocused = shouldReplaceAccepted && (acceptedSwapPhase === "focus" || acceptedSwapPhase === "settled");
  const showAcceptedConfetti = Boolean(product && isCelebrating && !(shouldReplaceAccepted && prefersReducedMotion));
  const displaySummary = isReplacementFocused
    ? `${alternativeName} is saved as your accepted BetterBite swap.`
    : swapSummary;
  const visibleAlternativeLabel = isReplacementTransitioning ? "Accepted swap" : alternativeLabel;
  const alternativePanelTarget =
    acceptedSwapPhase === "replace"
      ? { x: replaceDelta.x, y: replaceDelta.y, scale: 1.02 }
      : acceptedSwapPhase === "focus"
        ? { x: focusDelta.x, y: focusDelta.y, scale: 1 }
        : { x: 0, y: 0, scale: 1 };

  useEffect(() => {
    if (!shouldReplaceAccepted) {
      setAcceptedSwapPhase("idle");
      setReplaceDelta({ x: 0, y: 0 });
      setFocusDelta({ x: 0, y: 0 });
      setSettledPanelWidth(null);
      return;
    }

    if (hasSettledAcceptedSwap) {
      setAcceptedSwapPhase("settled");
      setReplaceDelta({ x: 0, y: 0 });
      setFocusDelta({ x: 0, y: 0 });
      return;
    }

    if (prefersReducedMotion) {
      setAcceptedSwapPhase("settled");
      setReplaceDelta({ x: 0, y: 0 });
      setFocusDelta({ x: 0, y: 0 });
      setSettledPanelWidth(null);
      if (product) {
        onAcceptedSwapSettled?.(product, alternative);
      }
      return;
    }

    setAcceptedSwapPhase("confetti");
    setReplaceDelta({ x: 0, y: 0 });
    setFocusDelta({ x: 0, y: 0 });
    setSettledPanelWidth(null);

    const timers = [
      window.setTimeout(() => {
        setAcceptedSwapPhase("rotate");
      }, ACCEPT_CONFETTI_MS),
      window.setTimeout(() => {
        const cardRect = cardRef.current?.getBoundingClientRect();
        const originalRect = originalPanelRef.current?.getBoundingClientRect();
        const alternativeRect = alternativePanelRef.current?.getBoundingClientRect();

        setReplaceDelta(
          originalRect && alternativeRect
            ? {
                x: originalRect.left - alternativeRect.left,
                y: originalRect.top - alternativeRect.top,
              }
            : { x: 0, y: 0 },
        );
        setFocusDelta(
          cardRect && alternativeRect
            ? {
                x: cardRect.left + (cardRect.width - alternativeRect.width) / 2 - alternativeRect.left,
                y: originalRect ? originalRect.top - alternativeRect.top : 0,
              }
            : { x: 0, y: 0 },
        );
        setSettledPanelWidth(alternativeRect ? Math.round(alternativeRect.width) : null);
        setAcceptedSwapPhase("replace");
      }, ACCEPT_CONFETTI_MS + ACCEPT_ROTATE_MS),
      window.setTimeout(() => {
        setAcceptedSwapPhase("focus");
      }, ACCEPT_CONFETTI_MS + ACCEPT_ROTATE_MS + ACCEPT_REPLACE_MS),
      window.setTimeout(() => {
        setAcceptedSwapPhase("settled");
        if (product) {
          onAcceptedSwapSettled?.(product, alternative);
        }
      }, ACCEPT_CONFETTI_MS + ACCEPT_ROTATE_MS + ACCEPT_REPLACE_MS + ACCEPT_FOCUS_MS),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [acceptedSwapKey, hasSettledAcceptedSwap, onAcceptedSwapSettled, prefersReducedMotion, shouldReplaceAccepted]);

  return (
    <div ref={cardRef} className="bento-card relative overflow-hidden">
      <div className="bg-oat px-4 py-3">
        <p className="text-sm font-bold leading-6 text-muted">{displaySummary}</p>
      </div>

      {isReplacementSettled ? (
        <motion.div
          key="accepted-swap-only"
          className="p-4"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          <div className="mx-auto w-full max-w-[210px]" style={settledPanelWidth ? { maxWidth: settledPanelWidth } : undefined}>
            <SwapFoodPanel
              tone="good"
              label="Accepted swap"
              name={alternativeName}
              detail={rightDetail}
              imageUrl={alternativeImageUrl}
              onSelect={() => onDetailChange("alternative")}
            />
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-[1fr_44px_1fr] items-start gap-2 p-4">
          <motion.div
            className="relative"
            ref={originalPanelRef}
            animate={{
              opacity: isReplacementTransitioning ? 0 : 1,
              scale: isReplacementTransitioning ? 0.96 : 1,
            }}
            transition={{ duration: ACCEPT_REPLACE_MS / 1000, ease: "easeOut" }}
          >
            <SwapFoodPanel
              tone={originalTone}
              label={originalLabel}
              name={leftName}
              detail={leftDetail}
              imageUrl={originalImageUrl}
              onSelect={() => onDetailChange("original")}
            />
          </motion.div>

          <div className="flex h-[132px] items-center justify-center">
            <motion.div
              className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink shadow-inset"
              aria-label="Interchangeable foods"
              title="Interchangeable foods"
              animate={{
                rotate: acceptedSwapPhase === "rotate" || acceptedSwapPhase === "replace" ? 360 : 0,
                scale: acceptedSwapPhase === "rotate" ? [1, 1.08, 1] : 1,
                opacity: acceptedSwapPhase === "focus" ? 0 : 1,
              }}
              transition={{
                opacity: { duration: 0.18, ease: "easeOut" },
                rotate: { duration: ACCEPT_ROTATE_MS / 1000, ease: "easeInOut" },
                scale: { duration: ACCEPT_ROTATE_MS / 1000, ease: "easeInOut" },
              }}
            >
              <RefreshCw size={22} strokeWidth={2.5} />
            </motion.div>
          </div>

          <motion.div
            className="relative"
            ref={alternativePanelRef}
            animate={alternativePanelTarget}
            transition={{
              duration: (acceptedSwapPhase === "focus" ? ACCEPT_FOCUS_MS : ACCEPT_REPLACE_MS) / 1000,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ zIndex: isReplacementTransitioning ? 2 : 1 }}
          >
            <SwapFoodPanel
              tone="good"
              label={visibleAlternativeLabel}
              name={alternativeName}
              detail={rightDetail}
              imageUrl={alternativeImageUrl}
              onSelect={() => onDetailChange("alternative")}
            />
          </motion.div>
        </div>
      )}

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
        {showAcceptedConfetti && product && <SwapAcceptedConfetti key={`${product.barcode}-${alternative.id}`} />}
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
    <button className="w-full min-w-0 text-left" onClick={onSelect} aria-label={`View details for ${name}`}>
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
  const prefersReducedMotion = useReducedMotion();
  const compactDayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const currentWeekRange = formatActivityWeekRange(chart.currentWeek);
  const activityHistoryTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.2, ease: "easeOut" },
        y: { duration: 0.24, ease: "easeOut" },
      };

  return (
    <div className="bento-card overflow-hidden p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-sky text-leaf">
            <CalendarDays size={21} />
          </div>
          <div>
            <p className="text-base font-black text-ink">{chart.currentStreak} day streak</p>
          </div>
        </div>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-oat hover:text-ink"
          onClick={() => setIsExpanded((value) => !value)}
          aria-label={isExpanded ? "Hide full activity history" : "Show full activity history"}
          aria-expanded={isExpanded}
        >
          <ChevronRight className={`transition-transform duration-300 ease-out ${isExpanded ? "rotate-90" : ""}`} size={22} />
        </button>
      </div>

      {currentWeekRange && <p className="mt-3 whitespace-nowrap text-[11px] font-black text-leaf">Current week: {currentWeekRange}</p>}

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-2 rounded-full bg-berry p-1">
          {chart.currentWeek.map((day) => {
            const hasActivity = day.count > 0;
            const isMissedLogin = !hasActivity && !day.isFuture;
            return (
              <span
                key={day.date}
                aria-label={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
                className={`flex h-9 w-9 justify-self-center items-center justify-center rounded-full ${hasActivity ? "bg-[#5E8E45]" : compactActivityColor(day.level, day.isFuture)}`}
                title={`${day.date}: ${day.count} activity point${day.count === 1 ? "" : "s"}`}
              >
                {hasActivity && (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cream">
                    <CheckCircle2 size={16} strokeWidth={3} className="text-[#5E8E45]" />
                  </span>
                )}
                {isMissedLogin && (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cream">
                    <CircleX className="text-[#E92D48]" size={16} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
                {!hasActivity && !isMissedLogin && <span className="h-3 w-3 rounded-full bg-cream/15" />}
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

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="full-activity-history"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={activityHistoryTransition}
            className="overflow-hidden"
          >
            <FullActivityChart chart={chart} />
          </motion.div>
        )}
      </AnimatePresence>
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
        <div className="bg-gradient-to-br from-[#12C8CA] to-[#007A79] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/85">Barcode</p>
          <h2 className="mt-3 text-2xl font-black leading-tight">Scan an ingredient label fast</h2>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#00696B] shadow-[0_12px_24px_rgba(0,105,107,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-white/70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onCameraScan}
          >
            <Camera size={17} />
            Camera
          </button>
        </div>
        <div className="flex items-center justify-center bg-[#DDF7EF] p-4">
          <div className="rounded-[26px] bg-white p-5 text-[#12C8CA] shadow-[0_14px_32px_rgba(0,180,184,0.12)]">
            <Barcode size={76} strokeWidth={1.8} />
          </div>
        </div>
      </div>

      <form className="space-y-3 p-4" onSubmit={onSubmit}>
        <label className="text-xs font-black uppercase tracking-[0.2em] text-[#00696B]" htmlFor="barcode">
          UPC or EAN
        </label>
        <div className="flex gap-2">
          <input
            id="barcode"
            inputMode="numeric"
            className="min-w-0 flex-1 rounded-[14px] border border-line bg-white px-4 py-3 text-base font-bold text-[#1F2629] outline-none transition placeholder:text-[#667080] focus:border-[#00C5C8] focus:ring-2 focus:ring-[#00C5C8]/20"
            placeholder="5449000000996"
            value={barcode}
            onChange={(event) => onBarcodeChange(event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_24px_rgba(0,128,128,0.18)] outline-none transition active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 disabled:opacity-60"
            onMouseDown={(event) => event.preventDefault()}
            disabled={isLoading}
            aria-label="Search barcode"
          >
            {isLoading ? <Loader2 className="animate-spin" size={21} /> : <Search size={21} />}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-[8px] bg-[#DDF7EF] px-3 py-2 text-sm font-semibold text-[#00696B]">
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
      <div className="bento-card bg-white p-4">
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
  showAlternatives = true,
}: {
  product: Product;
  score: QualityScore;
  alternatives: AlternativeProduct[];
  showAlternatives?: boolean;
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

      {showAlternatives && (
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
      )}
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
      className={`mx-0.5 flex h-[62px] flex-col items-center justify-center gap-1 rounded-full px-1 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 ${
        active ? "bg-[#AEEED8] text-[#0D503F]" : "text-[#3B4949] hover:bg-[#EEF7F8]"
      }`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
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

function scoreAccentColor(value: number): string {
  if (value <= 2) return "#df2f46";
  if (value <= 3) return "#f17955";
  if (value <= 5) return "#f4b65b";
  if (value <= 6) return "#f7dc62";
  if (value <= 8) return "#b7e55f";
  return "#73c84d";
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
  if (level <= 0) return "bg-[#df2f46]";
  if (level === 1) return "bg-[#174f18]";
  if (level === 2) return "bg-leaf";
  if (level === 3) return "bg-[#4d873f]";
  return "bg-sky";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function canUseLaptopCameraPreview(): boolean {
  return isBrowserCameraPreviewSupported() && !isLikelyMobileRuntime();
}

function isLikelyMobileRuntime(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function getBrowserCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return getBrowserCameraBlockedMessage();
    }

    if (error.name === "NotFoundError") {
      return "No camera was found on this laptop.";
    }

    if (error.name === "NotReadableError") {
      return "The camera is already being used by another app.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Camera scanning is unavailable on this target.";
}

async function getBrowserCameraPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return null;
  }
}

function getBrowserCameraBlockedMessage(): string {
  const host = typeof window !== "undefined" ? window.location.host : "";
  const hostCopy = host ? ` for ${host}` : "";

  return `Camera permission is blocked for this site. Allow camera access${hostCopy} in your browser settings, then tap Try camera again.`;
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
