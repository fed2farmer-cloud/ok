import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type ListingRow = {
  id: string;
  listing_number: number | null;
  loan_number: number;
  seller_user_id: string;
  principal_offered: number | string;
  principal_remaining: number | string;
  asking_price: number | string;
  status: string;
  expires_at: string | null;
  created_at: string | null;
};

function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export default function SecondaryMarket() {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase environment keys are missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("secondary_market_listings")
      .select("id, listing_number, loan_number, seller_user_id, principal_offered, principal_remaining, asking_price, status, expires_at, created_at")
      .in("status", ["open", "reserved", "partial"])
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setRows((data || []) as ListingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.principal += Number(row.principal_remaining || row.principal_offered || 0);
    acc.asking += Number(row.asking_price || 0);
    return acc;
  }, { principal: 0, asking: 0 }), [rows]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">Position resale</p>
            <h1 className="text-3xl font-black text-slate-950">Secondary Market</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Investor resale listings are visible here. Trading remains compliance-gated until legal, settlement, and investor-transfer controls are approved.</p>
          </div>
          <button onClick={() => void load()} className="rounded-xl bg-slate-950 px-4 py-2 font-black text-white shadow-sm hover:bg-slate-800">Refresh</button>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message}</div>}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Active Listings</p><p className="mt-2 text-3xl font-black">{rows.length}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Principal Offered</p><p className="mt-2 text-3xl font-black">{money(totals.principal)}</p></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Total Asking Price</p><p className="mt-2 text-3xl font-black">{money(totals.asking)}</p></div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rows.map((listing) => (
            <div className="rounded-2xl border bg-white p-5 shadow-sm" key={listing.id}>
              <div className="text-sm font-black text-slate-500">Listing #{listing.listing_number ?? '—'} · {listing.status}</div>
              <h2 className="mt-2 text-xl font-black">Loan #{listing.loan_number}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Principal Available</p><p className="font-black">{money(listing.principal_remaining)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Asking Price</p><p className="font-black">{money(listing.asking_price)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Created</p><p className="font-black">{dateOnly(listing.created_at)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Expires</p><p className="font-black">{dateOnly(listing.expires_at)}</p></div>
              </div>
              <button disabled className="mt-4 rounded-xl bg-slate-300 px-4 py-2 font-black text-slate-600">Trading disabled in test foundation</button>
            </div>
          ))}
        </div>

        {!loading && rows.length === 0 && <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-600 shadow-sm">No active secondary-market listings.</div>}
      </div>
    </AppLayout>
  );
}
