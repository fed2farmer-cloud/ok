import { VercelRequest, VercelResponse } from '@vercel/node';

const NMI_TIMEOUT_MS = 15000;

function parseNmi(text: string) {
  const p = new URLSearchParams(text.trim());
  return {
    approved: p.get('response') === '1',
    transactionId: p.get('transactionid') || p.get('transaction_id') || '',
    responseText: p.get('responsetext') || p.get('response_text') || 'Payment processing failed.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, message: 'Payment processing API is running' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const paymentToken = String(req.body?.paymentToken || '');
  const amount = Number(req.body?.amount);
  if (!paymentToken || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'A payment token and positive amount are required.' });
  }

  const apiKey = process.env.NMI_API_KEY;
  const env = String(process.env.NMI_ENVIRONMENT || 'sandbox').toLowerCase();
  const endpoint = env === 'production' || env === 'live'
    ? 'https://secure.nmi.com/api/transact.php'
    : 'https://sandbox.nmi.com/api/transact.php';
  if (!apiKey) return res.status(500).json({ success: false, error: 'NMI is not configured.' });

  const params = new URLSearchParams({
    security_key: apiKey,
    type: 'sale',
    payment_token: paymentToken,
    amount: amount.toFixed(2),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NMI_TIMEOUT_MS);
  try {
    const nmiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    const nmi = parseNmi(await nmiRes.text());
    if (!nmi.approved || !nmi.transactionId) {
      return res.status(402).json({ success: false, error: nmi.responseText });
    }
    return res.status(200).json({ success: true, message: 'Payment processed successfully', amount, transactionId: nmi.transactionId });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('NMI API request failed:', error);
    return res.status(timedOut ? 504 : 500).json({
      success: false,
      error: timedOut ? 'The payment processor took too long to respond. Check transaction history before retrying.' : 'Failed to process payment. Please try again later.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
