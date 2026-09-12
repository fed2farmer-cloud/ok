import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rawBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verified(body: Buffer, received: string) {
  const signingKey = process.env.PROOF_WEBHOOK_SIGNING_KEY || process.env.PROOF_API_KEY || "";
  if (!signingKey || !received) return false;
  const expected = createHmac("sha256", signingKey).update(body).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Missing Supabase server environment variables." });
    const bodyBuffer = await rawBody(req);
    const signature = String(req.headers["x-notarize-signature"] || "");
    if (!verified(bodyBuffer, signature)) return res.status(401).json({ error: "Invalid Proof webhook signature." });
    const payload = JSON.parse(bodyBuffer.toString("utf8") || "{}");
    const event = String(payload?.event || "");
    const transactionId = String(payload?.data?.transaction_id || payload?.data?.id || "");
    const occurredAt = payload?.data?.date_occurred || null;
    if (!event || !transactionId) return res.status(200).json({ received: true, ignored: true });

    const db = createClient(supabaseUrl, serviceRoleKey);
    await db.from("proof_webhook_events").upsert({
      proof_transaction_id: transactionId, event_name: event, occurred_at: occurredAt,
      payload, received_at: new Date().toISOString(),
    }, { onConflict: "proof_transaction_id,event_name,occurred_at", ignoreDuplicates: true });

    const { data: row } = await db.from("proof_notary_transactions")
      .select("id,loan_application_id")
      .eq("proof_transaction_id", transactionId).maybeSingle();
    if (!row) return res.status(200).json({ received: true, unmatched: true });

    const now = new Date().toISOString();
    const patch: Record<string, any> = { last_webhook_event: event, last_webhook_at: occurredAt || now, updated_at: now };
    if (event === "transaction.completed") {
      patch.status = "notarized"; patch.proof_transaction_status = "completed"; patch.notarized_at = occurredAt || now;
    } else if (event === "transaction.released") {
      patch.status = "released"; patch.proof_transaction_status = "released"; patch.released_at = occurredAt || now;
    } else if (["transaction.canceled", "transaction.declined"].includes(event)) {
      patch.status = event.endsWith("canceled") ? "canceled" : "declined";
      patch.proof_transaction_status = patch.status;
    } else if (event === "transaction.completed_with_rejections") {
      patch.status = "completed_with_rejections"; patch.proof_transaction_status = "completed_with_rejections";
    }
    await db.from("proof_notary_transactions").update(patch).eq("id", row.id);

    if (event === "transaction.completed" || event === "transaction.released") {
      await db.from("closing_tasks").update({ status: "completed", completed_at: occurredAt || now })
        .eq("loan_application_id", row.loan_application_id).eq("task_key", "online_notary");
      await db.from("loan_timeline_events").insert({
        loan_application_id: row.loan_application_id,
        event_key: event === "transaction.released" ? "proof_documents_released" : "proof_notarization_completed",
        title: event === "transaction.released" ? "Notarized documents released" : "Remote notarization completed",
        description: event === "transaction.released"
          ? "Proof released the completed closing documents. County recording is still required."
          : "Proof reported the remote notarization complete. This does not confirm county recording.",
      });
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Proof webhook processing failed." });
  }
}
