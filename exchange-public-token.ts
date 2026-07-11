import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath:
    PlaidEnvironments[
      process.env.PLAID_ENV as keyof typeof PlaidEnvironments
    ] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: "Missing Supabase server environment variables.",
      });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing user auth token." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid user token." });
    }

    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: "Missing public_token" });
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    const authResponse = await plaidClient.authGet({
      access_token: accessToken,
    });

    const account = authResponse.data.accounts?.find(
      (acct) => acct.subtype === "checking" || acct.subtype === "savings"
    ) || authResponse.data.accounts?.[0];

    if (!account) {
      return res.status(400).json({ error: "No bank account found from Plaid item." });
    }

    const accountNumbers = authResponse.data.numbers?.ach?.find(
      (ach) => ach.account_id === account.account_id
    ) || authResponse.data.numbers?.ach?.[0];

    const institutionName = authResponse.data.item?.institution_id || null;

    const upsertPayload = {
      user_id: user.id,
      plaid_item_id: itemId,
      plaid_account_id: account.account_id,
      plaid_access_token: accessToken,
      account_name: account.name || null,
      account_mask: account.mask || null,
      account_type: account.type || null,
      account_subtype: account.subtype || null,
      bank_name: institutionName,
      routing_number: accountNumbers?.routing || null,
      account_number: accountNumbers?.account || null,
      is_verified: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: savedBankAccount, error: saveError } = await supabase
      .from("investor_bank_accounts")
      .upsert(upsertPayload, {
        onConflict: "user_id,plaid_account_id",
      })
      .select()
      .single();

    if (saveError) {
      return res.status(500).json({ error: saveError.message });
    }

    return res.status(200).json({
      success: true,
      item_id: itemId,
      bank_account: savedBankAccount,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
}
