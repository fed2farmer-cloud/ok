import { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * ReportAll property-report endpoint.
 *
 * When REPORTALL_API_KEY is set the request is forwarded to the live
 * ReportAll API. Otherwise a realistic demo response is returned so the
 * UI can be built and tested without a live API key.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { dealId, county, state, ownerName, apn } = req.body ?? {};

  if (!county || !state) {
    return res.status(400).json({ error: "county and state are required" });
  }

  const apiKey = process.env.REPORTALL_API_KEY;

  if (apiKey) {
    try {
      const upstream = await fetch("https://api.reportall.com/v1/property-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ dealId, county, state, ownerName, apn }),
      });

      const data = await upstream.json();

      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: data?.message ?? "ReportAll API error" });
      }

      return res.status(200).json({ success: true, source: "reportall_live", report: data });
    } catch (err: any) {
      console.error("ReportAll upstream error:", err);
      return res.status(502).json({ error: "ReportAll API unreachable", details: err?.message });
    }
  }

  // Demo mode — return realistic placeholder data
  const demoReport = {
    reportId: `DEMO-${Date.now()}`,
    orderedAt: new Date().toISOString(),
    status: "complete",
    parcel: {
      apn: apn ?? "123-456-789",
      county,
      state,
      owner: ownerName ?? "Demo Property Owner",
      situs_address: "Demo Rd, Rural County, " + state,
      legal_description: "T2N R5E Section 14 NW1/4 SW1/4 20.00 AC",
      acreage: 20,
      land_use: "Agricultural",
      zoning: "A-1",
    },
    valuation: {
      assessed_value: 320000,
      market_value_estimate: 400000,
      last_sale_price: 295000,
      last_sale_date: "2021-06-15",
    },
    encumbrances: {
      open_liens: 0,
      mortgage_balance: 0,
      judgment_liens: 0,
      tax_liens: 0,
      notes: "No known liens. Title appears clear.",
    },
    ownership_chain: [
      { owner: ownerName ?? "Demo Owner", acquired: "2021-06-15", instrument: "Warranty Deed" },
    ],
    flood_zone: "Zone X — Minimal flood hazard",
    environmental_flags: [],
    max_loan_amount: 200000,
    ltv_at_50_pct: 200000,
    recommendation: "CLEAR — Suitable for land-backed loan up to 50% LTV.",
  };

  return res.status(200).json({
    success: true,
    source: "demo",
    message: "Set REPORTALL_API_KEY to activate live ReportAll reports.",
    report: demoReport,
  });
}
