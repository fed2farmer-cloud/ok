import { VercelRequest, VercelResponse } from '@vercel/node';

const NMI_TIMEOUT_MS = 15000;

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Handle GET requests
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Payment processing API is running',
      endpoint: '/api/process-payment',
      methods: ['POST'],
      description: 'Send POST requests with paymentToken and amount to process payments',
    });
  }

  // Handle POST requests
  if (req.method === 'POST') {
    const { paymentToken, amount } = req.body;

    // Validate input
    if (!paymentToken) {
      return res.status(400).json({
        success: false,
        error: 'paymentToken is required',
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount is required and must be a positive number',
      });
    }

    // Get NMI credentials from environment variables
    const nmiMerchantId = process.env.NMI_MERCHANT_ID;
    const nmiApiKey = process.env.NMI_API_KEY;
    const nmiApiEndpoint = process.env.NMI_API_ENDPOINT || 'https://api.nmi.com/api/transaction';

    if (!nmiMerchantId || !nmiApiKey) {
      console.error('Missing NMI credentials in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Missing payment processor credentials',
      });
    }

    try {
      // Prepare NMI payment request
      const params = new URLSearchParams({
        api_key: nmiApiKey,
        method: 'sale',
        payment_token: paymentToken,
        amount: amount.toString(),
      });

      // Do not let a slow processor/network leave the checkout spinning indefinitely.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NMI_TIMEOUT_MS);

      // Make request to NMI API
      const nmiResponse = fetch(nmiApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      // Process response - using Promise then/catch for compatibility
      return nmiResponse
        .then((response) => response.text())
        .then((text) => {
          // NMI's direct-post response is normally URL-encoded, e.g.
          // response=1&responsetext=SUCCESS&transactionid=123456789.
          // Never infer approval from a loose substring such as text.includes("1").
          const parsed = new URLSearchParams(text.trim());
          const responseCode = parsed.get('response');
          const responseText = parsed.get('responsetext') || 'Payment processing failed.';
          const transactionId = parsed.get('transactionid') || parsed.get('transaction_id');

          if (responseCode === '1' && transactionId) {
            console.log('Payment processed successfully', { transactionId });
            return res.status(200).json({
              success: true,
              message: 'Payment processed successfully',
              amount,
              transactionId,
            });
          }

          console.error('NMI API returned non-approved response:', {
            responseCode,
            responseText,
            hasTransactionId: Boolean(transactionId),
          });
          return res.status(400).json({
            success: false,
            error: responseText,
          });
        })
        .catch((error) => {
          console.error('NMI API request failed:', error);
          const timedOut = error instanceof Error && error.name === 'AbortError';
          return res.status(timedOut ? 504 : 500).json({
            success: false,
            error: timedOut
              ? 'The payment processor took too long to respond. No approval was received. Please check your transaction history before retrying.'
              : 'Failed to process payment. Please try again later.',
          });
        });
    } catch (error) {
      console.error('Payment processing error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred while processing your payment',
      });
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed. Use GET or POST.`,
  });
}
