import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  resolveStorageUrl,
  resolveStorageUrls,
} from "../lib/mediaStorage";
import AppLayout from "../components/AppLayout";
import InvestorPropertyGallery, {
  type InvestorPropertyPhoto,
} from "../components/InvestorPropertyGallery";
import FundingProgress from "../components/FundingProgress";
import InvestmentCalculator from "../components/InvestmentCalculator";
import VerificationBadges from "../components/VerificationBadges";

type MarketplaceLoan = {
  id: number;
  loan_application_id: string | number;
  loan_number?: number | null;
  business_name?: string | null;
  borrower_name?: string | null;
  apn?: string | null;
  county?: string | null;
  state?: string | null;
  land_type?: string | null;
  acreage?: number | null;
  risk_score?: string | null;
  land_value?: number | null;
  loan_amount?: number | null;
  funding_goal?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  investor_interest_rate?: number | null;
  repayment_term_months?: number | null;
  status?: string | null;
  created_at?: string | null;
  borrower_video_path?: string | null;
  borrower_video_status?: string | null;
  investor_refund_enabled?: boolean | null;
  investor_refund_days?: number | null;
};

type InvestorWallet = {
  available_balance?: number | null;
  invested_balance?: number | null;
};

type SortMode = "newest" | "rate" | "amount" | "funded" | "risk";

type VideoProps = {
  storagePath: string;
};

function ApprovedBorrowerVideo({ storagePath }: VideoProps) {
  const [urls, setUrls] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [state, setState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  useEffect(() => {
    let active = true;

    setState("loading");
    setUrls([]);
    setCandidateIndex(0);

    void resolveStorageUrls("borrower-videos", storagePath).then(
      (resolved) => {
        if (!active) return;

        setUrls(resolved);
        setState(resolved.length ? "ready" : "unavailable");
      }
    );

    return () => {
      active = false;
    };
  }, [storagePath]);

  if (state === "loading") {
    return (
      <div className="mt-5 animate-pulse rounded-2xl bg-slate-800 p-5 text-slate-300">
        Loading approved borrower video…
      </div>
    );
  }

  if (state === "unavailable" || !urls[candidateIndex]) {
    return (
      <div className="mt-5 rounded-2xl border border-amber-700/40 bg-amber-950/30 p-5 text-amber-100">
        Approved borrower video is temporarily unavailable.
      </div>
    );
  }

  return (
    <video
      key={urls[candidateIndex]}
      controls
      playsInline
      preload="metadata"
      className="mt-5 w-full rounded-2xl bg-black"
      src={urls[candidateIndex]}
      onLoadedMetadata={() => setState("ready")}
      onError={() => {
        const nextIndex = candidateIndex + 1;

        if (nextIndex < urls.length) {
          setCandidateIndex(nextIndex);
        } else {
          setState("unavailable");
        }
      }}
    >
      Your browser does not support video playback.
    </video>
  );
}

function riskRank(value?: string | null) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("low") || normalized.includes("a")) {
    return 1;
  }

  if (normalized.includes("medium") || normalized.includes("b")) {
    return 2;
  }

  if (normalized.includes("high") || normalized.includes("c")) {
    return 3;
  }

  return 9;
}

export default function InvestorMarketplace() {
  const navigate = useNavigate();

  const [loans, setLoans] = useState<MarketplaceLoan[]>([]);
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);

  const [photosByLoan, setPhotosByLoan] = useState<
    Record<string, InvestorPropertyPhoto[]>
  >({});

  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>(
    {}
  );

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [sortMode, setSortMode] =
    useState<SortMode>("newest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingLoanId, setProcessingLoanId] = useState<
    number | null
  >(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        "securedlanding-marketplace-favorites"
      );

      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch {
      // Ignore unavailable or malformed local storage.
    }
  }, []);

  const toggleFavorite = (loan: MarketplaceLoan) => {
    const key = String(loan.loan_application_id);

    setFavorites((current) => {
      const next = {
        ...current,
        [key]: !current[key],
      };

      try {
        window.localStorage.setItem(
          "securedlanding-marketplace-favorites",
          JSON.stringify(next)
        );
      } catch {
        // Ignore local storage write errors.
      }

      return next;
    });
  };

  const loadMarketplace = useCallback(
    async (silent = false) => {
      if (!supabase) {
        setErrorMessage("Supabase is not configured.");
        setLoading(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        const [
          { data: walletData, error: walletError },
          { data: loanData, error: loanError },
        ] = await Promise.all([
          supabase
            .from("investor_wallets")
            .select("available_balance,invested_balance")
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("marketplace_loans")
            .select("*")
            .eq("status", "Open")
            .order("created_at", { ascending: false }),
        ]);

        if (walletError) throw walletError;
        if (loanError) throw loanError;

        let marketplaceLoans = (loanData ?? []) as MarketplaceLoan[];

        setWallet(walletData ?? null);

        const applicationIds = [
          ...new Set(
            marketplaceLoans
              .map((loan) => String(loan.loan_application_id))
              .filter(Boolean)
          ),
        ];

        if (applicationIds.length > 0) {
          const { data: applications, error: applicationsError } =
            await supabase
              .from("loan_applications")
              .select(
                "id,borrower_video_path,borrower_video_status,county,land_type,repayment_term_months"
              )
              .in("id", applicationIds);

          if (applicationsError) {
            console.error(
              "Loan application details could not be loaded:",
              applicationsError.message
            );
          }

          const byId = new Map(
            (applications ?? []).map((row: any) => [
              String(row.id),
              row,
            ])
          );

          marketplaceLoans = marketplaceLoans.map((loan) => {
            const application = byId.get(
              String(loan.loan_application_id)
            );

            return {
              ...loan,
              borrower_video_path:
                application?.borrower_video_path ??
                loan.borrower_video_path,
              borrower_video_status:
                application?.borrower_video_status ??
                loan.borrower_video_status,
              county: application?.county ?? loan.county,
              land_type: application?.land_type ?? loan.land_type,
              repayment_term_months:
                application?.repayment_term_months ??
                loan.repayment_term_months,
            };
          });

          const { data: photoData, error: photoError } =
            await supabase
              .from("property_photos")
              .select(
                "id,loan_application_id,storage_path,caption,is_cover,created_at,review_status"
              )
              .in("loan_application_id", applicationIds)
              .eq("review_status", "approved")
              .order("created_at", { ascending: true });

          if (photoError) {
            console.error(
              "Approved property photos could not be loaded:",
              photoError.message
            );

            setPhotosByLoan({});
          } else {
            const hydrated = await Promise.all(
              (photoData ?? []).map(async (photo: any) => ({
                ...photo,
                signed_url: await resolveStorageUrl(
                  "property-photos",
                  photo.storage_path
                ),
              }))
            );

            const grouped: Record<
              string,
              InvestorPropertyPhoto[]
            > = {};

            hydrated
              .filter((photo) => Boolean(photo.signed_url))
              .forEach((photo) => {
                const key = String(photo.loan_application_id);

                grouped[key] = [
                  ...(grouped[key] ?? []),
                  photo as InvestorPropertyPhoto,
                ];
              });

            setPhotosByLoan(grouped);
          }
        } else {
          setPhotosByLoan({});
        }

        setLoans(marketplaceLoans);
      } catch (error: unknown) {
        console.error("Marketplace loading failed:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load investment opportunities."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  const states = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          loans
            .map((loan) => loan.state)
            .filter(Boolean) as string[]
        )
      ).sort(),
    ],
    [loans]
  );

  const visibleLoans = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = loans.filter((loan) => {
      const key = String(loan.loan_application_id);

      const matchesSearch =
        !query ||
        [
          loan.business_name,
          loan.borrower_name,
          loan.state,
          loan.county,
          loan.land_type,
          loan.apn,
          loan.loan_number,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      const matchesState =
        stateFilter === "All" || loan.state === stateFilter;

      const matchesFavorite =
        !favoritesOnly || favorites[key];

      return (
        matchesSearch &&
        matchesState &&
        matchesFavorite
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "rate") {
        return (
          Number(b.investor_interest_rate || 0) -
          Number(a.investor_interest_rate || 0)
        );
      }

      if (sortMode === "amount") {
        return (
          Number(a.funding_goal ?? a.loan_amount ?? 0) -
          Number(b.funding_goal ?? b.loan_amount ?? 0)
        );
      }

      if (sortMode === "funded") {
        const aPercent =
          Number(a.amount_funded || 0) /
          Math.max(
            Number(a.funding_goal ?? a.loan_amount ?? 1),
            1
          );

        const bPercent =
          Number(b.amount_funded || 0) /
          Math.max(
            Number(b.funding_goal ?? b.loan_amount ?? 1),
            1
          );

        return bPercent - aPercent;
      }

      if (sortMode === "risk") {
        return riskRank(a.risk_score) - riskRank(b.risk_score);
      }

      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [
    favorites,
    favoritesOnly,
    loans,
    search,
    sortMode,
    stateFilter,
  ]);

  function money(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }

  async function handleInvestFromWallet(
    loan: MarketplaceLoan,
    investmentAmount: number,
    remaining: number
  ) {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      return;
    }

    const publicLoanNumber = Number(
      loan.loan_number ?? loan.loan_application_id
    );

    const availableBalance = Number(
      wallet?.available_balance || 0
    );

    if (
      !Number.isFinite(publicLoanNumber) ||
      publicLoanNumber <= 0
    ) {
      setErrorMessage(
        "This opportunity does not have a valid public loan number."
      );
      return;
    }

    if (
      !Number.isFinite(investmentAmount) ||
      investmentAmount < 100
    ) {
      setErrorMessage("The minimum investment is $100.");
      return;
    }

    if (investmentAmount > remaining) {
      setErrorMessage(
        "The investment exceeds the amount remaining on this loan."
      );
      return;
    }

    if (investmentAmount > availableBalance) {
      setErrorMessage(
        "You do not have enough available wallet cash."
      );
      return;
    }

    const confirmed = window.confirm(
      `Invest ${money(
        investmentAmount
      )} from your available wallet cash in Loan #${publicLoanNumber}?\n\nThis investment includes a 7-day investor refund period.`
    );

    if (!confirmed) return;

    setProcessingLoanId(loan.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "invest_from_wallet_v28",
        {
          p_loan_number: publicLoanNumber,
          p_amount: investmentAmount,
        }
      );

      if (error) throw error;

      if (!data) {
        throw new Error(
          "The wallet investment did not return a completed investment record."
        );
      }

      setAmounts((current) => ({
        ...current,
        [loan.id]: "",
      }));

      setSuccessMessage(
        `${money(
          investmentAmount
        )} was invested from available wallet cash in Loan #${publicLoanNumber}.`
      );

      await loadMarketplace(true);

      window.setTimeout(() => {
        navigate("/portfolio");
      }, 900);
    } catch (error: unknown) {
      console.error("Wallet investment failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The wallet investment could not be completed."
      );
    } finally {
      setProcessingLoanId(null);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl space-y-5 p-8">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              Investment Marketplace
            </h1>

            <p className="text-slate-600">
              Compare reviewed land-backed opportunities and
              estimate potential returns.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMarketplace(true)}
            disabled={refreshing}
            className="rounded-xl bg-slate-700 px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {refreshing
              ? "Refreshing…"
              : "Refresh Opportunities"}
          </button>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-rose-300 bg-rose-100 p-4 font-semibold text-rose-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-100 p-4 font-semibold text-emerald-800">
            {successMessage}
          </div>
        )}

        <div className="mb-8 grid gap-4 rounded-2xl bg-slate-950 p-6 text-white sm:grid-cols-2">
          <div>
            <div className="text-sm text-slate-400">
              Available Wallet Cash
            </div>

            <div className="mt-1 text-4xl font-black">
              {money(wallet?.available_balance)}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-400">
              Invested Balance
            </div>

            <div className="mt-1 text-4xl font-black text-emerald-400">
              {money(wallet?.invested_balance)}
            </div>
          </div>
        </div>

        <section className="mb-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search business, state, county…"
            className="rounded-xl border border-slate-300 px-4 py-3 md:col-span-2"
          />

          <select
            value={stateFilter}
            onChange={(event) =>
              setStateFilter(event.target.value)
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          >
            {states.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as SortMode)
            }
            className="rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="newest">Newest first</option>
            <option value="rate">Highest return</option>
            <option value="amount">Lowest loan amount</option>
            <option value="funded">Most funded</option>
            <option value="risk">Lowest risk first</option>
          </select>

          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 md:col-span-4">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) =>
                setFavoritesOnly(event.target.checked)
              }
            />

            Show watchlist only
          </label>
        </section>

        <div className="mb-4 text-sm font-semibold text-slate-600">
          Showing {visibleLoans.length} of {loans.length} opportunities
        </div>

        <div className="space-y-8">
          {visibleLoans.map((loan) => {
            const goal = Number(
              loan.funding_goal ?? loan.loan_amount ?? 0
            );

            const funded = Number(
              loan.amount_funded ?? 0
            );

            const remaining = Math.max(
              Number(
                loan.amount_remaining ??
                  goal - funded
              ),
              0
            );

            const photos =
              photosByLoan[
                String(loan.loan_application_id)
              ] ?? [];

            const isFavorite = Boolean(
              favorites[
                String(loan.loan_application_id)
              ]
            );

            const investmentAmount = Number(
              amounts[loan.id] || 0
            );

            const availableBalance = Number(
              wallet?.available_balance || 0
            );

            const invalidInvestment =
              !Number.isFinite(investmentAmount) ||
              investmentAmount < 100 ||
              investmentAmount > remaining ||
              investmentAmount > availableBalance;

            const publicLoanNumber =
              loan.loan_number ??
              loan.loan_application_id;

            const protectionEnabled =
              loan.investor_refund_enabled !== false;

            const protectionDays =
              loan.investor_refund_days ?? 7;

            return (
              <article
                key={loan.id}
                className="rounded-3xl bg-[#111] p-6 text-slate-200 shadow-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-emerald-500">
                      {loan.business_name ||
                        "No Business Name"}
                    </h2>

                    <VerificationBadges
                      hasApprovedPhotos={
                        photos.length > 0
                      }
                      hasApprovedVideo={
                        loan.borrower_video_status ===
                          "approved" &&
                        Boolean(
                          loan.borrower_video_path
                        )
                      }
                      hasLandValue={
                        Number(
                          loan.land_value || 0
                        ) > 0
                      }
                      riskScore={loan.risk_score}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleFavorite(loan)
                      }
                      className={`rounded-full px-3 py-2 text-lg ${
                        isFavorite
                          ? "bg-amber-400 text-slate-950"
                          : "bg-slate-800 text-white"
                      }`}
                      aria-label={
                        isFavorite
                          ? "Remove from watchlist"
                          : "Add to watchlist"
                      }
                    >
                      {isFavorite ? "★" : "☆"}
                    </button>

                    <span className="rounded-full bg-slate-800 px-4 py-2 font-bold text-violet-300">
                      {loan.status || "Open"}
                    </span>
                  </div>
                </div>

                {protectionEnabled &&
                  protectionDays > 0 && (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-950 px-4 py-2 text-sm font-bold text-emerald-300">
                      <span aria-hidden="true">
                        🛡️
                      </span>

                      {protectionDays}-Day Investment Protection
                    </div>
                  )}

                {photos.length > 0 && (
                  <InvestorPropertyGallery
                    photos={photos}
                    loanLabel={
                      loan.business_name ||
                      `Loan ${publicLoanNumber}`
                    }
                  />
                )}

                {loan.borrower_video_status ===
                  "approved" &&
                  loan.borrower_video_path && (
                    <ApprovedBorrowerVideo
                      storagePath={
                        loan.borrower_video_path
                      }
                    />
                  )}

                <div className="mt-6 grid gap-3 text-base sm:grid-cols-2">
                  <p>
                    <strong>Borrower:</strong>{" "}
                    {loan.borrower_name ||
                      "Not provided"}
                  </p>

                  <p>
                    <strong>APN:</strong>{" "}
                    {loan.apn || "Not provided"}
                  </p>

                  <p>
                    <strong>Location:</strong>{" "}
                    {[loan.county, loan.state]
                      .filter(Boolean)
                      .join(", ") || "Not provided"}
                  </p>

                  <p>
                    <strong>Land type:</strong>{" "}
                    {loan.land_type ||
                      "Not provided"}
                  </p>

                  <p>
                    <strong>Acres:</strong>{" "}
                    {loan.acreage ??
                      "Not provided"}
                  </p>

                  <p>
                    <strong>Risk score:</strong>{" "}
                    {loan.risk_score ||
                      "Not rated"}
                  </p>

                  <p>
                    <strong>Land value:</strong>{" "}
                    {money(loan.land_value)}
                  </p>

                  <p>
                    <strong>Loan amount:</strong>{" "}
                    {money(goal)}
                  </p>

                  <p>
                    <strong>
                      Investor return:
                    </strong>{" "}
                    {Number(
                      loan.investor_interest_rate ||
                        9
                    ).toFixed(2)}
                    %
                  </p>

                  <p>
                    <strong>Term:</strong>{" "}
                    {loan.repayment_term_months ||
                      36}{" "}
                    months
                  </p>

                  <p>
                    <strong>
                      Amount remaining:
                    </strong>{" "}
                    {money(remaining)}
                  </p>

                  <p>
                    <strong>Loan ID:</strong>{" "}
                    {publicLoanNumber}
                  </p>
                </div>

                <FundingProgress
                  funded={funded}
                  goal={goal}
                  createdAt={loan.created_at}
                />

                <InvestmentCalculator
                  amount={
                    amounts[loan.id] ?? ""
                  }
                  onAmountChange={(value) =>
                    setAmounts((current) => ({
                      ...current,
                      [loan.id]: value,
                    }))
                  }
                  annualRate={Number(
                    loan.investor_interest_rate ||
                      9
                  )}
                  termMonths={
                    loan.repayment_term_months
                  }
                  availableBalance={
                    availableBalance
                  }
                  maxAmount={remaining}
                />

                <button
                  type="button"
                  disabled={
                    invalidInvestment ||
                    processingLoanId === loan.id
                  }
                  onClick={() =>
                    void handleInvestFromWallet(
                      loan,
                      investmentAmount,
                      remaining
                    )
                  }
                  className="mt-5 w-full rounded-xl bg-emerald-600 py-4 text-xl font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  {processingLoanId === loan.id
                    ? "Processing Wallet Investment..."
                    : "Invest From Wallet"}
                </button>

                <p className="mt-3 text-center text-xs text-slate-500">
                  This button uses available wallet cash and does not redirect to NMI.
                </p>
              </article>
            );
          })}

          {visibleLoans.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-600 shadow">
              No opportunities match these filters.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}