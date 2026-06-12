import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { FormEvent, useReducer } from "react";
import {
  INITIAL_FOOD_SEARCH_STATE,
  friendlyTypesenseError,
  reduceFoodSearchState,
  searchFoods,
  type FoodSearchResult,
} from "../lib/typesenseSearch";

export function SearchScreen() {
  const [state, dispatch] = useReducer(reduceFoodSearchState, INITIAL_FOOD_SEARCH_STATE);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.status === "loading") {
      return;
    }

    const query = state.query.trim();
    if (!query) {
      dispatch({ type: "queryChanged", query: "" });
      return;
    }

    dispatch({ type: "searchStarted", query });

    try {
      const results = await searchFoods(query);
      dispatch({ type: "searchSucceeded", query, results });
    } catch (error) {
      dispatch({ type: "searchFailed", query, error: friendlyTypesenseError(error) });
    }
  }

  const hasSearched = Boolean(state.submittedQuery);

  return (
    <div className="-mx-5 min-h-full bg-[#F8FAFB] pb-10">
      <div className="px-5 pb-4 pt-8">
        <h2 className="text-[32px] font-black leading-tight text-[#191C1D]">Search foods</h2>
        <p className="mt-1 text-[18px] font-medium leading-7 text-[#3B4949]">Find the food you already want, then compare cleaner options.</p>
      </div>

      <div className="sticky top-0 z-10 border-b border-[#BAC9C9]/40 bg-[#F8FAFB]/95 px-5 py-4 backdrop-blur">
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Search foods</span>
            <Search className="pointer-events-none absolute left-4 text-[#566164]" size={20} strokeWidth={2.2} />
            <input
              value={state.query}
              onChange={(event) => dispatch({ type: "queryChanged", query: event.target.value })}
              className="h-[52px] w-full rounded-[16px] border border-[#BAC9C9]/70 bg-white px-12 py-4 text-[16px] font-semibold leading-6 text-[#191C1D] shadow-[0_8px_24px_rgba(0,105,107,0.08)] outline-none transition placeholder:text-[#7A8587] focus:border-[#00A8AB] focus:ring-4 focus:ring-[#00C5C8]/20"
              placeholder="Search chips, soda, cookies..."
              type="search"
            />
          </label>
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-[#00696B] text-white shadow-[0_10px_22px_rgba(0,105,107,0.22)] transition hover:bg-[#005B5D] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#7A8587] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/45"
            aria-label="Search foods"
          >
            {state.status === "loading" ? <Loader2 className="animate-spin" size={22} /> : <Search size={22} />}
          </button>
        </form>
      </div>

      <div className="space-y-4 px-5 pt-6">
        {state.status === "idle" && <SearchEmptyState title="Try a craving" body="Search for chips, soda, fries, burgers, cookies, cereal, yogurt, or frozen meals." />}

        {state.status === "loading" && (
          <div className="flex items-center gap-3 rounded-[18px] border border-[#DDE8E9] bg-white p-4 text-[#3B4949] shadow-[0_4px_20px_rgba(0,105,107,0.08)]">
            <Loader2 className="animate-spin text-[#00696B]" size={22} />
            <p className="text-sm font-bold">Searching local Typesense foods...</p>
          </div>
        )}

        {state.status === "error" && state.error && (
          <div className="rounded-[18px] border border-[#FFDAD6] bg-[#FFF4F2] p-4 text-[#BA1A1A] shadow-[0_4px_20px_rgba(186,26,26,0.08)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" size={22} />
              <div>
                <p className="text-sm font-black">Search is unavailable</p>
                <p className="mt-1 text-sm font-semibold leading-5">{state.error}</p>
              </div>
            </div>
          </div>
        )}

        {state.status === "empty" && (
          <SearchEmptyState title={`No foods found for "${state.submittedQuery}"`} body="Try a broader craving like chips, soda, fries, cookies, cereal, burgers, or yogurt." />
        )}

        {state.results.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#566164]">
                {hasSearched ? `Results for ${state.submittedQuery}` : "Results"}
              </p>
              <p className="text-sm font-bold text-[#00696B]">{state.results.length} foods</p>
            </div>

            <div className="space-y-3">
              {state.results.map((result) => (
                <FoodResultCard
                  key={result.id}
                  result={result}
                  selected={state.selectedResult?.id === result.id}
                  onSelect={() => dispatch({ type: "resultSelected", result })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {state.selectedResult && (
        <FoodDetailPanel result={state.selectedResult} onClose={() => dispatch({ type: "detailClosed" })} />
      )}
    </div>
  );
}

function SearchEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#DDF7EF] text-[#00696B]">
        <Search size={34} />
      </div>
      <h3 className="mt-5 text-2xl font-black text-[#191C1D]">{title}</h3>
      <p className="mt-2 max-w-[300px] text-sm font-semibold leading-6 text-[#566164]">{body}</p>
    </div>
  );
}

function FoodResultCard({ result, selected, onSelect }: { result: FoodSearchResult; selected: boolean; onSelect: () => void }) {
  const tags = Array.from(new Set([...result.cravingTags.slice(0, 2), ...result.healthTags.slice(0, 1)]));

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-4 rounded-xl border bg-white/80 p-3 text-left shadow-[0_4px_20px_rgba(0,105,107,0.08)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35 ${
        selected ? "border-[#00696B]" : "border-[#DDE8E9]"
      }`}
      onClick={onSelect}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[#DDF7EF] text-[20px] font-black text-[#00696B]">
        {result.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[17px] font-semibold leading-6 text-black">{result.name}</h3>
        <p className="truncate text-[14px] font-semibold leading-5 text-[#3B4949]">
          {result.brand} · {result.category}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#EEF7F8] px-2 py-0.5 text-[12px] font-semibold leading-4 text-[#3B4949]">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <FoodScore value={result.betterbiteScore} />
    </button>
  );
}

function FoodDetailPanel({ result, onClose }: { result: FoodSearchResult; onClose: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] rounded-t-[28px] border border-[#DDE8E9] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-4 shadow-[0_-20px_50px_rgba(0,105,107,0.18)] md:absolute">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#00696B]">Prototype detail</p>
          <h3 className="mt-1 text-[22px] font-black leading-7 text-[#191C1D]">{result.name}</h3>
          <p className="mt-1 text-sm font-bold text-[#566164]">
            {result.brand} · {result.category}
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF7F8] text-[#3B4949] transition hover:bg-[#DDE8E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C5C8]/35"
          onClick={onClose}
          aria-label="Close food detail"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 rounded-[18px] bg-[#F8FAFB] p-4">
        <FoodScore value={result.betterbiteScore} large />
        <div className="min-w-0">
          <p className="text-sm font-black text-[#191C1D]">Ingredient summary</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-[#566164]">{result.ingredientsSummary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from(new Set([...result.cravingTags, ...result.formatTags, ...result.healthTags])).slice(0, 9).map((tag) => (
          <span key={tag} className="rounded-full bg-[#EEF7F8] px-3 py-1 text-xs font-bold text-[#3B4949]">
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-4 rounded-[14px] bg-[#FFF7E8] px-4 py-3 text-sm font-semibold leading-5 text-[#5C4418]">
        Swap integration comes later. This prototype only verifies local Typesense search and food-result selection.
      </p>
    </div>
  );
}

function FoodScore({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <div
      className={`${large ? "h-16 w-16 text-xl" : "h-12 w-12 text-base"} flex shrink-0 items-center justify-center rounded-full font-black ${
        value >= 8 ? "bg-[#73C84D] text-[#10230E]" : value >= 6 ? "bg-[#B7E55F] text-[#1B2B11]" : value >= 4 ? "bg-[#F4B65B] text-[#2B1C05]" : "bg-[#DF2F46] text-white"
      }`}
      aria-label={`BetterBite prototype score ${value} out of 10`}
    >
      {value}
    </div>
  );
}
