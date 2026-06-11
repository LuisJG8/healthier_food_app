import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CircleSlash2,
  Droplets,
  Dumbbell,
  Eye,
  Fish,
  Flame,
  HeartPulse,
  Leaf,
  LockKeyhole,
  Mail,
  MilkOff,
  Palette,
  Play,
  Salad,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  WheatOff,
  Zap,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect } from "react";
import boulderCanyonChips from "../assets/boulder-canyon-chips.avif";
import burgerKingFries from "../assets/burger-king-fries.jpg";
import appLogo from "../assets/healthier-food-logo-option-07.png";
import welcomeFoodHero from "../assets/onboarding-food-hero.png";
import type { DietPreference, FoodAvoidance, MainGoal, OnboardingProfile, SwapStrictness } from "../types";

export type OnboardingStep = "welcome" | "benefits" | "scan-swap" | "main-goal" | "diet" | "avoid" | "strictness" | "account" | "app";

type VisibleOnboardingStep = Exclude<OnboardingStep, "app">;

interface OnboardingFlowProps {
  step: VisibleOnboardingStep;
  profile: OnboardingProfile;
  onBack: () => void;
  onContinue: () => void;
  onMainGoalToggle: (goal: MainGoal) => void;
  onDietPreferenceToggle: (preference: DietPreference) => void;
  onFoodAvoidanceToggle: (avoidance: FoodAvoidance) => void;
  onSwapStrictnessToggle: (strictness: SwapStrictness) => void;
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon: ReactNode;
  tint: string;
}

const BENEFITS = [
  { label: "Lower risk of diseases", icon: <ShieldCheck size={22} strokeWidth={2.2} /> },
  { label: "Better brain function", icon: <Brain size={22} strokeWidth={2.2} /> },
  { label: "More energy", icon: <Zap size={22} strokeWidth={2.2} /> },
  { label: "Stronger immune system", icon: <HeartPulse size={22} strokeWidth={2.2} /> },
  { label: "Live longer", icon: <Sparkles size={22} strokeWidth={2.2} /> },
];

const MAIN_GOAL_OPTIONS: Array<ChoiceOption<MainGoal>> = [
  { value: "eat-healthier", label: "Eat healthier overall", icon: <Salad size={19} />, tint: "bg-[#DDF7EF] text-[#00696B]" },
  { value: "energy-focus", label: "Improve energy & focus", icon: <Brain size={19} />, tint: "bg-[#D7F1F6] text-[#00637A]" },
  { value: "manage-weight", label: "Manage weight", icon: <Scale size={19} />, tint: "bg-[#E6F6DF] text-[#256D1B]" },
  { value: "fitness-goals", label: "Support fitness goals", icon: <Dumbbell size={19} />, tint: "bg-[#B6F4E4] text-[#00696B]" },
  { value: "reduce-inflammation", label: "Reduce inflammation", icon: <Droplets size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
  { value: "long-term-health", label: "Feel better long-term", icon: <HeartPulse size={19} />, tint: "bg-[#F0F7E5] text-[#256D1B]" },
];

const DIET_OPTIONS: Array<ChoiceOption<DietPreference>> = [
  { value: "no-preference", label: "No preference", icon: <Sparkles size={19} />, tint: "bg-[#DDF7EF] text-[#00696B]" },
  { value: "vegetarian", label: "Vegetarian", icon: <Leaf size={19} />, tint: "bg-[#CFF5D5] text-[#256D1B]" },
  { value: "vegan", label: "Vegan", icon: <Leaf size={19} />, tint: "bg-[#E6F6DF] text-[#256D1B]" },
  { value: "pescatarian", label: "Pescatarian", icon: <Fish size={19} />, tint: "bg-[#D7F1F6] text-[#00637A]" },
  { value: "keto-low-carb", label: "Keto / Low carb", icon: <ActivityIcon />, tint: "bg-[#DDF7EF] text-[#007477]" },
  { value: "gluten-free", label: "Gluten-free", icon: <WheatOff size={19} />, tint: "bg-[#F2EED9] text-[#6B5B00]" },
  { value: "dairy-free", label: "Dairy-free", icon: <MilkOff size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
];

const FOOD_AVOIDANCE_OPTIONS: Array<ChoiceOption<FoodAvoidance>> = [
  { value: "none", label: "None", icon: <CircleSlash2 size={19} />, tint: "bg-[#DDF7EF] text-[#00696B]" },
  { value: "seed-oils", label: "Seed oils", icon: <Droplets size={19} />, tint: "bg-[#D7F1F6] text-[#00637A]" },
  { value: "added-sugars", label: "Added sugars", icon: <Sparkles size={19} />, tint: "bg-[#F2EED9] text-[#6B5B00]" },
  { value: "artificial-sweeteners", label: "Artificial sweeteners", icon: <Zap size={19} />, tint: "bg-[#DDF7EF] text-[#007477]" },
  { value: "artificial-colors", label: "Artificial colors", icon: <Palette size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
  { value: "high-sodium", label: "High sodium", icon: <Flame size={19} />, tint: "bg-[#F0F7E5] text-[#256D1B]" },
  { value: "gluten", label: "Gluten", icon: <WheatOff size={19} />, tint: "bg-[#F2EED9] text-[#6B5B00]" },
  { value: "dairy", label: "Dairy", icon: <MilkOff size={19} />, tint: "bg-[#E3F1F6] text-[#00637A]" },
  { value: "gmos", label: "GMOs", icon: <Leaf size={19} />, tint: "bg-[#CFF5D5] text-[#256D1B]" },
];

const SWAP_STRICTNESS_OPTIONS: Array<ChoiceOption<SwapStrictness>> = [
  {
    value: "closest-match",
    label: "Closest match",
    description: "Preserve the same craving first.",
    icon: <Target size={20} />,
    tint: "bg-[#DDF7EF] text-[#00696B]",
  },
  {
    value: "cleaner-ingredients",
    label: "Cleaner ingredients",
    description: "Prioritize simpler labels.",
    icon: <Leaf size={20} />,
    tint: "bg-[#CFF5D5] text-[#256D1B]",
  },
  {
    value: "lower-sugar-sodium",
    label: "Lower sugar or sodium",
    description: "Prefer lighter everyday options.",
    icon: <HeartPulse size={20} />,
    tint: "bg-[#E3F1F6] text-[#00637A]",
  },
  {
    value: "avoid-seed-oils",
    label: "Avoid seed oils",
    description: "Look for better oil choices.",
    icon: <Droplets size={20} />,
    tint: "bg-[#D7F1F6] text-[#00637A]",
  },
  {
    value: "same-convenience",
    label: "Same convenience",
    description: "Keep swaps easy to choose.",
    icon: <ArrowRight size={20} />,
    tint: "bg-[#B6F4E4] text-[#00696B]",
  },
  {
    value: "strict-clean-label",
    label: "Strict clean-label",
    description: "Only the cleanest close alternatives.",
    icon: <ShieldCheck size={20} />,
    tint: "bg-[#F0F7E5] text-[#256D1B]",
  },
];

export function OnboardingFlow({
  step,
  profile,
  onBack,
  onContinue,
  onMainGoalToggle,
  onDietPreferenceToggle,
  onFoodAvoidanceToggle,
  onSwapStrictnessToggle,
}: OnboardingFlowProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [step]);

  return (
    <main className="min-h-[100dvh] bg-[#F7FAFB] text-[#1F2629]">
      <div className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#F7FAFB] shadow-[0_24px_70px_rgba(0,105,107,0.12)] md:my-6 md:h-[900px] md:max-h-[calc(100vh-3rem)] md:rounded-[34px]">
        {step === "welcome" && <WelcomeScreen onContinue={onContinue} />}
        {step === "benefits" && <BenefitsScreen onBack={onBack} onContinue={onContinue} />}
        {step === "scan-swap" && <ScanSwapScreen onBack={onBack} onContinue={onContinue} />}
        {step === "main-goal" && (
          <QuestionScreen
            title="What's your main goal?"
            subtitle="Choose all that apply."
            options={MAIN_GOAL_OPTIONS}
            values={profile.mainGoals}
            onBack={onBack}
            onContinue={onContinue}
            onToggle={onMainGoalToggle}
          />
        )}
        {step === "diet" && (
          <QuestionScreen
            title="What's your diet preference?"
            subtitle="Choose all that apply."
            options={DIET_OPTIONS}
            values={profile.dietPreferences}
            onBack={onBack}
            onContinue={onContinue}
            onToggle={onDietPreferenceToggle}
          />
        )}
        {step === "avoid" && (
          <QuestionScreen
            title="Any foods or ingredients you want to avoid?"
            subtitle="Choose all that apply."
            options={FOOD_AVOIDANCE_OPTIONS}
            values={profile.foodsToAvoid}
            onBack={onBack}
            onContinue={onContinue}
            onToggle={onFoodAvoidanceToggle}
          />
        )}
        {step === "strictness" && (
          <QuestionScreen
            title="How strict should we be with swaps?"
            subtitle="Choose your preference."
            options={SWAP_STRICTNESS_OPTIONS}
            values={profile.swapStrictness}
            onBack={onBack}
            onContinue={onContinue}
            onToggle={onSwapStrictnessToggle}
          />
        )}
        {step === "account" && <AccountScreen onBack={onBack} onComplete={onContinue} />}
      </div>
    </main>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <section className="flex h-full min-h-0 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+42px)]">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <img src={appLogo} alt="BetterBite" className="h-[62px] w-[62px] object-contain" />
        <h1 className="mt-3 text-center text-[22px] font-black leading-none text-[#00696B]">BetterBite</h1>

        <div className="mt-8 flex h-[232px] w-full max-w-[330px] items-center justify-center overflow-hidden rounded-[28px] bg-white shadow-[0_18px_46px_rgba(0,105,107,0.13)]">
          <img src={welcomeFoodHero} alt="Assorted foods and healthier swaps" className="h-full w-full object-cover" />
        </div>

        <h2 className="mt-8 max-w-[330px] text-center text-[26px] font-black leading-[1.06] text-[#063F41]">
          Find healthier alternatives to the foods you already love.
        </h2>
        <p className="mt-3 max-w-[300px] text-center text-[15px] font-semibold leading-6 text-[#566164]">
          Similar taste. Better ingredients. Smarter swaps.
        </p>
      </div>

      <PrimaryButton label="Get Started" onClick={onContinue} />
    </section>
  );
}

function BenefitsScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <ScreenFrame onBack={onBack} footer={<PrimaryButton label="Next" onClick={onContinue} />}>
      <div className="pt-4 text-center">
        <h1 className="text-[25px] font-black leading-[1.08] text-[#063F41]">Why it matters</h1>
        <p className="mt-2 text-[15px] font-semibold leading-5 text-[#566164]">Better choices. Better you.</p>
      </div>

      <div className="mt-8 space-y-3">
        {BENEFITS.map((benefit) => (
          <div key={benefit.label} className="flex min-h-[58px] items-center gap-4 border-b border-[#DDE6E7] pb-3 last:border-b-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DDF7EF] text-[#00696B]">
              {benefit.icon}
            </span>
            <span className="min-w-0 flex-1 text-[16px] font-black leading-5 text-[#1F2629]">{benefit.label}</span>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

function ScanSwapScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <ScreenFrame onBack={onBack} footer={<PrimaryButton label="Next" onClick={onContinue} />}>
      <div className="pt-2 text-center">
        <h1 className="mx-auto max-w-[310px] text-[24px] font-black leading-[1.08] text-[#063F41]">Scan. We analyze. You swap.</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] font-semibold leading-5 text-[#566164]">
          See how BetterBite finds a similar, healthier alternative.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-[#7EDFE0] bg-gradient-to-br from-[#B6F4E4] to-[#16CBCD] p-5 text-white shadow-[0_18px_38px_rgba(0,128,128,0.16)]">
        <div className="flex aspect-video items-center justify-center rounded-[18px] bg-white/24">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#00696B] shadow-[0_12px_24px_rgba(0,105,107,0.14)]">
            <Play size={30} fill="currentColor" strokeWidth={0} />
          </span>
        </div>
        <p className="mt-3 text-center text-[13px] font-black text-white">( Demo video placeholder )</p>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_38px_1fr] items-stretch gap-2">
        <SwapPreviewCard
          eyebrow="You scanned"
          title="Burger King Fries"
          image={burgerKingFries}
          score="3.4/10"
          scoreTone="bg-[#C93C30]"
        />
        <div className="flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00696B] text-white shadow-[0_10px_22px_rgba(0,105,107,0.24)]">
            <ArrowRight size={22} strokeWidth={2.8} />
          </span>
        </div>
        <SwapPreviewCard
          eyebrow="Better swap"
          title="Boulder Canyon Kettle Chips"
          image={boulderCanyonChips}
          score="7.9/10"
          scoreTone="bg-[#00696B]"
        />
      </div>
      <p className="mt-4 rounded-[8px] bg-[#DDF7EF] px-4 py-3 text-center text-[13px] font-bold leading-5 text-[#00696B]">
        Same salty potato craving, cleaner ingredients.
      </p>
    </ScreenFrame>
  );
}

function QuestionScreen<T extends string>({
  title,
  subtitle,
  options,
  values,
  onBack,
  onContinue,
  onToggle,
}: {
  title: string;
  subtitle: string;
  options: Array<ChoiceOption<T>>;
  values: T[];
  onBack: () => void;
  onContinue: () => void;
  onToggle: (value: T) => void;
}) {
  return (
    <ScreenFrame
      onBack={onBack}
      footer={<PrimaryButton label="Next" disabled={values.length === 0} onClick={onContinue} />}
    >
      <div className="pt-2 text-center">
        <h1 className="mx-auto max-w-[330px] text-[22px] font-black leading-[1.12] text-[#063F41]">{title}</h1>
        <p className="mt-2 text-[14px] font-semibold leading-5 text-[#566164]">{subtitle}</p>
      </div>

      <div className="mt-5 space-y-2.5 pb-1">
        {options.map((option) => {
          const isSelected = values.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              className={`relative flex min-h-[50px] w-full items-center gap-3 overflow-hidden rounded-[14px] border px-3.5 py-2.5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40 ${
                isSelected
                  ? "border-[#009A9D] bg-gradient-to-r from-[#E1FAF4] to-white shadow-[0_12px_28px_rgba(0,105,107,0.15),inset_0_0_0_1px_rgba(0,154,157,0.22)] ring-2 ring-[#00C5C8]/35"
                  : "border-[#D9E4E5] bg-white/72 hover:border-[#00C5C8] active:bg-[#EEF7F8]"
              }`}
              onClick={() => onToggle(option.value)}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                  isSelected ? "scale-105 shadow-[0_8px_18px_rgba(0,105,107,0.16)] ring-2 ring-white" : ""
                } ${option.tint}`}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] font-black leading-5 ${isSelected ? "text-[#063F41]" : "text-[#1F2629]"}`}>{option.label}</span>
                {option.description && (
                  <span className={`mt-0.5 block text-[12px] font-semibold leading-4 ${isSelected ? "text-[#00696B]" : "text-[#566164]"}`}>
                    {option.description}
                  </span>
                )}
              </span>
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border transition ${
                  isSelected ? "border-[#009A9D] bg-[#009A9D] text-white shadow-[0_6px_14px_rgba(0,105,107,0.24)]" : "border-[#B9CCCF] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={14} strokeWidth={3.2} />
              </span>
            </button>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

function AccountScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onComplete();
  }

  return (
    <ScreenFrame onBack={onBack} footer={null}>
      <div className="pt-1 text-center">
        <h1 className="text-[24px] font-black leading-[1.1] text-[#063F41]">Create your account</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] font-semibold leading-5 text-[#566164]">
          Save your preferences and scans across devices.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-3">
        <label className="block">
          <span className="sr-only">Email address</span>
          <span className="flex h-[56px] items-center gap-3 rounded-[14px] border border-[#D9E4E5] bg-white px-4 text-[#667080]">
            <Mail size={20} strokeWidth={2.2} className="shrink-0 text-[#657A7C]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-[#9BA5A7]"
              type="email"
              placeholder="Email address"
              autoComplete="email"
            />
          </span>
        </label>

        <label className="block">
          <span className="sr-only">Password</span>
          <span className="flex h-[56px] items-center gap-3 rounded-[14px] border border-[#D9E4E5] bg-white px-4 text-[#667080]">
            <LockKeyhole size={20} strokeWidth={2.2} className="shrink-0 text-[#657A7C]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-[#9BA5A7]"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
            />
            <Eye size={21} strokeWidth={2.2} className="shrink-0 text-[#657A7C]" />
          </span>
        </label>

        <PrimaryButton label="Create account" type="submit" />
      </form>

      <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-[13px] font-extrabold text-[#748284]">
        <span className="h-px bg-[#DDE6E7]" />
        <span>or</span>
        <span className="h-px bg-[#DDE6E7]" />
      </div>

      <button
        type="button"
        className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#CDDCDD] bg-white text-[15px] font-extrabold text-[#111517] transition hover:border-[#00C5C8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
        onClick={onComplete}
      >
        <span className="text-[22px] font-black text-[#4285F4]">G</span>
        Continue with Google
      </button>

      <button
        type="button"
        className="mt-5 flex h-10 w-full items-center justify-center rounded-full text-[14px] font-black text-[#00696B] transition hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
        onClick={onComplete}
      >
        Continue to app
      </button>
    </ScreenFrame>
  );
}

function ScreenFrame({
  onBack,
  children,
  footer,
}: {
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pb-[5px] pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex h-10 items-center">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#063F41] transition hover:bg-[#EEF7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40"
            aria-label="Go back"
            onClick={onBack}
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
      <footer className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3">{footer}</footer>
    </section>
  );
}

function SwapPreviewCard({
  eyebrow,
  title,
  image,
  score,
  scoreTone,
}: {
  eyebrow: string;
  title: string;
  image: string;
  score: string;
  scoreTone: string;
}) {
  return (
    <div className="min-w-0 rounded-[16px] border border-[#D9E4E5] bg-white p-2.5 shadow-[0_10px_22px_rgba(0,105,107,0.07)]">
      <p className="text-center text-[11px] font-extrabold leading-4 text-[#566164]">{eyebrow}</p>
      <p className="mt-1 min-h-[34px] text-center text-[12px] font-black leading-[1.18] text-[#1F2629]">{title}</p>
      <div className="relative mt-2 flex h-[82px] items-center justify-center overflow-hidden rounded-[12px] bg-[#F7FAFB]">
        <img src={image} alt="" className="h-full w-full object-cover" />
        <span className={`absolute bottom-1.5 right-1.5 rounded-full px-2 py-1 text-[11px] font-black text-white ${scoreTone}`}>{score}</span>
      </div>
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled = false,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const isNextButton = label === "Next";

  return (
    <button
      type={type}
      className={`flex h-[56px] ${isNextButton ? "mx-auto w-1/2" : "w-full"} items-center justify-center gap-2 rounded-[14px] text-[17px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/40 ${
        disabled
          ? "bg-[#D6E0E2] text-[#9BA5A7]"
          : "bg-gradient-to-r from-[#12C8CA] to-[#007A79] text-white shadow-[0_12px_26px_rgba(0,128,128,0.22)] active:translate-y-px"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      {isNextButton && <ArrowRight size={20} strokeWidth={2.8} />}
    </button>
  );
}

function ActivityIcon() {
  return <Flame size={19} />;
}
