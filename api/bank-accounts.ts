import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data, error } = await supabase
    .from("investor_bank_accounts")
    .select(`
      id,
      bank_name,
      account_name,
      account_subtype,
      account_number,
      plaid_account_id,
      is_active,
      is_verified
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("bank_name");

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    accounts: data || [],
  });
}