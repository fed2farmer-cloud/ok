import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" } });
  try {
    const { loan_application_id } = await req.json();
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: loan, error } = await client.from("loan_applications").select("*").eq("id", loan_application_id).single();
    if (error) throw error;
    if (loan.borrower_video_status !== "approved") throw new Error("Borrower video must be approved before marketplace publishing.");
    const { error: upsertError } = await client.from("marketplace_loans").upsert({ loan_application_id: loan.id, loan_number: loan.loan_number, business_name: loan.business_name, borrower_name: loan.full_name, state: loan.state, acreage: loan.acreage, land_value: loan.land_value, loan_amount: loan.loan_amount, borrower_interest_rate: loan.borrower_interest_rate, investor_interest_rate: loan.investor_interest_rate, repayment_term_months: loan.repayment_term_months, borrower_video_path: loan.borrower_video_path, borrower_video_status: loan.borrower_video_status, status: "Open" }, { onConflict: "loan_application_id" });
    if (upsertError) throw upsertError;
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
});
