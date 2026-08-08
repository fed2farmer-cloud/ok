import { VercelRequest, VercelResponse } from '@vercel/node';

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
    const nmiEnvironment = String(process.env.NMI_ENVIRONMENT || 'sandbox').toLowerCase();
    const nmiApiEndpoint = nmiEnvironment === 'production' || nmiEnvironment === 'live'
      ? 'https://secure.nmi.com/api/transact.php'
      : 'https://sandbox.nmi.com/api/transact.php';

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
        security_key: nmiApiKey,
        type: 'sale',
        payment_token: paymentToken,
        amount: amount.toString(),
      });

      // Make request to NMI API
      const nmiResponse = fetch(nmiApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      // Process response - using Promise then/catch for compatibility
      return nmiResponse
        .then((response) => response.text())
        .then((text) => {
          const parsed = new URLSearchParams(text.trim());
          const approved = parsed.get('response') === '1';
          const transactionId = parsed.get('transactionid') || parsed.get('transaction_id') || '';
          const responseText = parsed.get('responsetext') || parsed.get('response_text') || text.slice(0, 500);

          if (approved && transactionId) {
            console.log('Payment processed successfully');
            return res.status(200).json({
              success: true,
              message: 'Payment processed successfully',
              amount,
              transactionId,
              environment: nmiEnvironment,
            });
          } else {
            console.error('NMI API returned error:', text);
            return res.status(400).json({
              success: false,
              error: responseText || 'Payment processing failed. Please try again.',
            });
          }
        })
        .catch((error) => {
          console.error('NMI API request failed:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to process payment. Please try again later.',
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
