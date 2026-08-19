import { VercelRequest, VercelResponse } from '@vercel/node';

const NMI_TIMEOUT_MS = 15000;

function nmiEndpoint(): string {
  const env = String(process.env.NMI_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production' || env === 'live'
    ? 'https://secure.nmi.com/api/v5/payments/sale'
    : 'https://sandbox.nmi.com/api/v5/payments/sale';
}

function errorText(data: any): string {
  return String(
    data?.response_text ||
    data?.message ||
    data?.error ||
    data?.errors?.[0]?.message ||
    'Payment processing failed.'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'NMI v5 payment processing API is running',
      environment: String(process.env.NMI_ENVIRONMENT || 'sandbox').toLowerCase(),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const paymentToken = String(req.body?.paymentToken || '').trim();
  const amount = Number(req.body?.amount);

  if (!paymentToken || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'A payment token and positive amount are required.',
    });
  }

  // Current Vercel name first; retain the older name only as a fallback.
  const privateApiKey = String(
    process.env.NMI_SECURITY_KEY || process.env.NMI_API_KEY || ''
  ).trim();

  if (!privateApiKey) {
    return res.status(500).json({
      success: false,
      error: 'NMI private API key is not configured. Set NMI_SECURITY_KEY.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NMI_TIMEOUT_MS);

  try {
    const nmiRes = await fetch(nmiEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: privateApiKey,
      },
      body: JSON.stringify({
        amount: Number(amount.toFixed(2)),
        payment_details: {
          payment_token: paymentToken,
        },
      }),
      signal: controller.signal,
    });

    const raw = await nmiRes.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { response_text: raw || 'Invalid response from NMI.' };
    }

    const approved = String(data?.response ?? '') === '1';
    const transactionId = String(data?.id || data?.transaction_id || '').trim();

    if (!nmiRes.ok || !approved || !transactionId) {
      console.error('NMI v5 payment declined/failed', {
        status: nmiRes.status,
        response: data?.response,
        response_text: data?.response_text,
      });
      return res.status(nmiRes.status >= 400 ? nmiRes.status : 402).json({
        success: false,
        error: errorText(data),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      amount: Number(amount.toFixed(2)),
      transactionId,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('NMI v5 API request failed:', error);
    return res.status(timedOut ? 504 : 500).json({
      success: false,
      error: timedOut
        ? 'The payment processor took too long to respond. Check transaction history before retrying.'
        : 'Failed to process payment. Please try again later.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
