import { NmiPayments } from "@nmipayments/nmi-pay-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";
import { getNmiTokenizationKey } from "../lib/nmi";
import {
  purchaseSecondaryListing,
  type SecondaryListing,
} from "../lib/secondaryMarket";

type PaymentMethod = "wallet" | "split" | "card";

function money(value: unknown) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export default function SecondaryCertificateCheckout() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<SecondaryListing | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(0);
  const [buyerId, setBuyerId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cardFunded, setCardFunded] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase || !listingId) {
        if (active) {
          setError("The database connection or listing number is unavailable.");
          setLoading(false);
        }
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        const [listingResult, walletResult] = await Promise.all([
          supabase
            .from("secondary_market_open_v2")
            .select("*")
            .eq("id", listingId)
            .maybeSingle(),
          supabase
            .from("investor_wallets")
            .select("available_balance")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (listingResult.error) throw listingResult.error;
        if (walletResult.error) throw walletResult.error;
        if (!listingResult.data) {
          throw new Error("This certificate is no longer available for purchase.");
        }

        const nextListing = listingResult.data as SecondaryListing;
        const available = Number(walletResult.data?.available_balance || 0);
        if (!active) return;

        setListing(nextListing);
        setWalletAvailable(available);
        setBuyerId(user.id);
        setMethod(
          available >= Number(nextListing.asking_price)
            ? "wallet"
            : available > 0
              ? "split"
              : "card"
        );
      } catch (loadError) {
        if (active) {
          setError(errorText(loadError, "Unable to load certificate checkout."));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [listingId, navigate]);

  const price = Number(listing?.asking_price || 0);
  const walletContribution =
    method === "wallet" || method === "split"
      ? Math.min(walletAvailable, price)
      : 0;
  const cardContribution = Math.max(price - walletContribution, 0);
  const nmiCharge = cardContribution > 0 ? Math.max(cardContribution, 10) : 0;
  const walletRemainder = Math.max(nmiCharge - cardContribution, 0);
  const isSeller = Boolean(listing && buyerId === listing.seller_user_id);

  const nmiConfiguration = useMemo(() => {
    try {
      return { key: getNmiTokenizationKey(), error: "" };
    } catch (configurationError) {
      return {
        key: "",
        error: errorText(
          configurationError,
          "NMI card payments are not configured."
        ),
      };
    }
  }, []);

  function finish(result: any) {
    const certificateNumber =
      result?.certificate_number || listing?.certificate_number || "certificate";
    setStatus(`Purchase complete. ${certificateNumber} is now in your portfolio.`);
    window.setTimeout(() => {
      navigate(
        `/investment-certificate/${encodeURIComponent(String(certificateNumber))}`,
        { replace: true }
      );
    }, 900);
  }

  async function buyFromWallet() {
    if (!listing || processing || isSeller) return;
    setProcessing(true);
    setError("");
    setStatus("Completing certificate transfer from wallet cash…");
    try {
      const result = await purchaseSecondaryListing(listing.id);
      finish(result);
    } catch (purchaseError) {
      setStatus("");
      setError(
        errorText(purchaseError, "The wallet purchase could not be completed.")
      );
    } finally {
      setProcessing(false);
    }
  }

  async function listingIsStillOpen() {
    if (!supabase || !listing) return false;
    const { data, error: listingError } = await supabase
      .from("secondary_market_open_v2")
      .select("id")
      .eq("id", listing.id)
      .maybeSingle();
    if (listingError) throw listingError;
    return Boolean(data);
  }

  async function payCardAndBuy(paymentToken: string) {
    if (!supabase || !listing || processing || isSeller) {
      return "This purchase cannot be processed.";
    }
    if (cardFunded) {
      return "The card was already funded. Complete the purchase with Wallet instead of charging the card again.";
    }

    setProcessing(true);
    setError("");
    setStatus("Checking listing availability before charging the card…");

    try {
      if (!(await listingIsStillOpen())) {
        throw new Error(
          "This certificate is no longer available. No card charge was attempted."
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Please sign in again before purchasing.");

      setStatus(`Processing ${money(nmiCharge)} securely through NMI…`);
      const response = await fetch("/api/process-wallet-card-deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ paymentToken, amount: nmiCharge }),
      });
      const data = await response.json().catch(() => ({
        success: false,
        error: "The payment processor returned an invalid response.",
      }));

      if (!response.ok || !data.success) {
        const processorMessage = data.error || "The card payment failed.";
        if (data.paymentApproved) {
          setCardFunded(true);
          setStatus("");
          setError(
            `${processorMessage} Do not retry the card payment. NMI transaction #${
              data.transactionId || "unknown"
            } must be reconciled.`
          );
        } else {
          setStatus("");
          setError(processorMessage);
        }
        return processorMessage;
      }

      setCardFunded(true);
      setWalletAvailable(Number(data.availableBalance || walletAvailable + nmiCharge));
      setStatus(
        `Card approved (#${data.transactionId}). Completing certificate transfer…`
      );

      try {
        const result = await purchaseSecondaryListing(listing.id);
        finish(result);
        return true;
      } catch (purchaseError) {
        const updatedAvailable = Number(data.availableBalance || 0);
        if (updatedAvailable >= price) setMethod("wallet");
        const message = errorText(
          purchaseError,
          "The certificate transfer could not be completed."
        );
        setStatus("");
        setError(
          `NMI approved the card and added ${money(
            nmiCharge
          )} to your wallet, but the certificate was not transferred: ${message} Do not charge the card again; use Wallet to retry or contact support.`
        );
        return "Card approved, but certificate transfer needs attention. Do not retry the card.";
      }
    } catch (paymentError) {
      const message = errorText(paymentError, "Unable to process this purchase.");
      setStatus("");
      setError(message);
      return message;
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white shadow-xl sm:px-7 sm:py-6">
          <Link
            to="/secondary-market"
            className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
          >
            ← Secondary Market
          </Link>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Certificate Checkout
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Complete Your Purchase
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Pay from wallet cash, combine wallet cash with an NMI card payment, or use a card for the full amount.
          </p>
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-relaxed text-rose-800">
            {error}
          </div>
        )}
        {status && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {status}
          </div>
        )}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading certificate checkout…
          </div>
        ) : listing ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                Purchase summary
              </p>
              <Link
                to={`/investment-certificate/${encodeURIComponent(
                  listing.certificate_number
                )}`}
                className="mt-2 block break-all text-base font-black text-slate-950 underline decoration-emerald-400 underline-offset-4"
              >
                {listing.certificate_number}
              </Link>
              <Link
                to={`/secondary-market/loan/${listing.loan_number}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700"
              >
                Original Loan #{listing.loan_number} →
              </Link>

              <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Seller price</span>
                  <strong>{money(price)}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Principal transferred</span>
                  <strong>{money(listing.current_principal)}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Original investment</span>
                  <strong>{money(listing.original_principal)}</strong>
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
                  <span className="font-bold">Total purchase</span>
                  <strong className="text-emerald-700">{money(price)}</strong>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Wallet cash available
                </p>
                <p className="mt-1 text-xl font-black text-emerald-700">
                  {money(walletAvailable)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-base font-black text-slate-950">Choose payment method</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ["wallet", "Wallet"],
                    ["split", "Wallet + Card"],
                    ["card", "Card"],
                  ] as Array<[PaymentMethod, string]>
                ).map(([value, label]) => {
                  const disabled =
                    (value === "wallet" && walletAvailable < price) ||
                    (value === "split" &&
                      (walletAvailable <= 0 || walletAvailable >= price));
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled || processing || isSeller}
                      onClick={() => {
                        setMethod(value);
                        setError("");
                        setStatus("");
                      }}
                      className={`rounded-xl border px-2 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-35 sm:text-sm ${
                        method === value
                          ? "border-emerald-400 bg-emerald-950 text-emerald-200"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Wallet contribution</span>
                  <strong>{money(walletContribution)}</strong>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-slate-500">NMI card contribution</span>
                  <strong>{money(cardContribution)}</strong>
                </div>
                <div className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2">
                  <span className="font-bold">Purchase total</span>
                  <strong>{money(price)}</strong>
                </div>
              </div>

              {isSeller && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
                  You own this certificate. A seller cannot purchase their own listing.
                </div>
              )}

              {method === "wallet" && !isSeller && (
                <button
                  type="button"
                  disabled={processing || walletAvailable < price}
                  onClick={() => void buyFromWallet()}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-4 text-base font-black text-white shadow-md hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {processing
                    ? "Transferring Certificate…"
                    : `Buy from Wallet — ${money(price)}`}
                </button>
              )}

              {(method === "split" || method === "card") && !isSeller && (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                    Secure NMI card payment
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {method === "split"
                      ? `${money(walletContribution)} wallet + ${money(
                          cardContribution
                        )} card`
                      : `${money(cardContribution)} charged to card`}
                  </p>
                  {walletRemainder > 0 && (
                    <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                      NMI’s minimum card charge is $10.00. The extra {money(
                        walletRemainder
                      )} remains available in your wallet after purchase.
                    </p>
                  )}
                  {nmiConfiguration.error ? (
                    <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950 px-3 py-2 text-xs text-rose-200">
                      {nmiConfiguration.error}
                    </p>
                  ) : processing ? (
                    <div className="mt-3 rounded-xl bg-white/10 px-3 py-4 text-center text-sm font-bold text-slate-200">
                      Processing payment—do not close this page.
                    </div>
                  ) : (
                    <div className="mt-3 [&_button]:w-full [&_button]:rounded-xl [&_button]:bg-gradient-to-r [&_button]:from-emerald-600 [&_button]:to-blue-700 [&_button]:px-4 [&_button]:py-4 [&_button]:font-black [&_button]:text-white">
                      <NmiPayments
                        tokenizationKey={nmiConfiguration.key}
                        paymentMethods={["card"]}
                        onPay={(event) => payCardAndBuy(event.token)}
                      />
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                Card payments are credited to your SecuredLanding wallet first, then the wallet purchase transfers certificate ownership and credits the seller. If the transfer fails after approval, do not charge the card again.
              </p>
            </section>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
