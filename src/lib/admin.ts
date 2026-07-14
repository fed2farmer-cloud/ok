import { supabase } from "./supabase";
export async function refreshLoanDocuments() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.from("loan_documents").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
