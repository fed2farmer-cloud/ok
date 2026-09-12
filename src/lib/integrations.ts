async function postJson<T>(path: string, payload: unknown, token?: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data as T;
}

export function createPlaidLinkToken(userId: string, dealId: string) {
  return postJson("/api/plaid", { action: "create_link_token", user_id: userId, deal_id: dealId });
}

export function verifyPlaidAccount(publicToken: string, dealId: string, token?: string) {
  return postJson("/api/plaid", { action: "exchange_public_token", public_token: publicToken, deal_id: dealId }, token);
}

/** Order a ReportAll property report. Uses the Vercel API function directly. */
export function orderReportAllPropertyReport(
  dealId: string,
  county: string,
  state: string,
  ownerName: string,
  apn?: string
) {
  return postJson("/api/reportall-property-report", { dealId, county, state, ownerName, apn });
}

/** Showcase-only reservation helper; production investments use the live marketplace flow. */
export async function createInvestorReservation(dealId: string, investorName: string, amount: number) {
  return { demo: true, dealId, investorName, amount, message: "Demo reservation recorded locally." };
}
