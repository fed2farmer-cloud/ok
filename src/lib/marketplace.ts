import { supabase } from "./supabase";
export async function syncApprovedBorrowerVideo(applicationId: string | number, storagePath: string | null, status: string | null) {
  if (!supabase || status !== "approved") return;
  const { error } = await supabase.from("marketplace_loans").update({ borrower_video_path: storagePath, borrower_video_status: status }).eq("loan_application_id", applicationId);
  if (error) throw error;
}
