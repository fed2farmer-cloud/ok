import { createClient } from "@supabase/supabase-js";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV || "sandbox";

  if (!clientId) throw new Error("Missing PLAID_CLIENT_ID in Vercel Environment Variables");
  if (!secret) throw new Error("Missing PLAID_SECRET in Vercel Environment Variables");

  const basePath =
    PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] ||
    PlaidEnvironments.sandbox;

  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    })
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = String(req.body?.action || "create_link_token");

  try {
    const plaidClient = getPlaidClient();

    if (action === "create_link_token") {
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: String(req.body?.user_id || "securedlanding-user"),
        },
        client_name: "SecuredLanding",
        products: [Products.Auth],
        country_codes: [CountryCode.Us],
        language: "en",
      });

      return res.status(200).json({
        link_token: response.data.link_token,
      });
    }

    if (action === "exchange_public_token") {
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

      const publicToken = req.body?.public_token;
      if (!publicToken) {
        return res.status(400).json({ error: "Missing public_token" });
      }

      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;
      const authResponse = await plaidClient.authGet({ access_token: accessToken });

      const account =
        authResponse.data.accounts?.find(
          (acct) => acct.subtype === "checking" || acct.subtype === "savings"
        ) || authResponse.data.accounts?.[0];

      if (!account) {
        return res.status(400).json({ error: "No bank account found from Plaid item." });
      }

      const accountNumbers =
        authResponse.data.numbers?.ach?.find(
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
        .upsert(upsertPayload, { onConflict: "user_id,plaid_account_id" })
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
    }

    return res.status(400).json({ error: "Unknown Plaid action." });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.response?.data || error?.message || "Plaid request failed.",
    });
  }
}
