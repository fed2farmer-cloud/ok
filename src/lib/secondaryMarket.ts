import { supabase } from './supabase';

export type SecondaryListing = {
  id: string;
  investment_id: number;
  certificate_number: string;
  loan_number: number;
  public_loan_number?: number;
  seller_user_id: string;
  original_principal: number;
  current_principal: number;
  asking_price: number;
  listed_at: string;
  discount_to_original_percent: number;
  discount_to_current_principal_percent: number;
};


export function getPublicLoanNumber(listing: Pick<SecondaryListing, "loan_number" | "certificate_number" | "public_loan_number">): number {
  const explicit = Number(listing.public_loan_number);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  // Certificate format: SLI-YYYY-PUBLICLOAN-SERIAL.  This is also a
  // compatibility fallback for older listings that accidentally stored the
  // internal loan_applications.id in loan_number.
  const match = String(listing.certificate_number || "").match(/^SLI-\d{4}-(\d+)-\d+$/i);
  if (match) {
    const fromCertificate = Number(match[1]);
    if (Number.isFinite(fromCertificate) && fromCertificate > 0) return fromCertificate;
  }

  return Number(listing.loan_number);
}

export async function loadSecondaryListings(): Promise<SecondaryListing[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('secondary_market_open_v2')
    .select('*')
    .order('listed_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as SecondaryListing[];
}

export async function listInvestmentForSale(
  investmentId: number,
  askingPrice: number
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc(
    'create_secondary_listing_v2',
    {
      p_investment_id: investmentId,
      p_asking_price: askingPrice,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function purchaseSecondaryListing(
  listingId: string
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error(
      'You must be signed in to buy a certificate.'
    );
  }

  const idempotencyKey =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${user.id}-${listingId}-${Date.now()}`;

  const { data, error } = await supabase.rpc(
    'secondary_market_settle',
    {
      p_listing_id: listingId,
      p_buyer_id: user.id,
      p_key: idempotencyKey,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function cancelSecondaryListing(
  listingId: string
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc(
    'cancel_secondary_listing_v2',
    {
      p_listing_id: listingId,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}
