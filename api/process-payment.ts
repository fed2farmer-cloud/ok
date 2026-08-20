import { VercelRequest, VercelResponse } from '@vercel/node';

const NMI_TIMEOUT_MS = 15000;

type NmiTarget = {
  endpoint: string;
  environment: 'live' | 'sandbox';
  source: 'NMI_ENVIRONMENT' | 'NMI_GATEWAY_URL' | 'default';
};

function resolveNmiTarget(): NmiTarget {
  const explicitEnv = String(process.env.NMI_ENVIRONMENT || '').trim().toLowerCase();
  if (explicitEnv) {
    const live = explicitEnv === 'production' || explicitEnv === 'live';
    return {
      endpoint: live
        ? 'https://secure.nmi.com/api/v5/payments/sale'
        : 'https://sandbox.nmi.com/api/v5/payments/sale',
      environment: live ? 'live' : 'sandbox',
      source: 'NMI_ENVIRONMENT',
    };
  }

  // SecuredLanding already has NMI_GATEWAY_URL configured in Vercel.  v4.1.6
  // ignored it and therefore silently defaulted to the sandbox v5 endpoint.
  // A token created with a live merchant tokenization key is not valid in the
  // sandbox gateway, which NMI reports as "Invalid payment token".
  const configuredGateway = String(process.env.NMI_GATEWAY_URL || '').trim().toLowerCase();
  if (configuredGateway) {
    const sandbox = configuredGateway.includes('sandbox');
    return {
      endpoint: sandbox
        ? 'https://sandbox.nmi.com/api/v5/payments/sale'
        : 'https://secure.nmi.com/api/v5/payments/sale',
      environment: sandbox ? 'sandbox' : 'live',
      source: 'NMI_GATEWAY_URL',
    };
  }

  // Production site safety: do not silently send production tokenization keys
  // to sandbox when no environment selector exists.
  return {
    endpoint: 'https://secure.nmi.com/api/v5/payments/sale',
    environment: 'live',
    source: 'default',
  };
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
  const target = resolveNmiTarget();

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'NMI v5 payment processing API is running',
      environment: target.environment,
      environmentSource: target.source,
      endpointHost: new URL(target.endpoint).host,
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

  const privateApiKey = String(
    process.env.NMI_SECURITY_KEY || process.env.NMI_API_KEY || ''
  ).trim();

  if (!privateApiKey) {
    return res.status(500).json({
      success: false,
      error: 'NMI private API key is not configured. Set NMI_SECURITY_KEY.',
    });
  }

  // Safe diagnostics only. Never log the token, key, PAN, CVV, or expiration.
  const tokenDiagnostics = {
    tokenPresent: true,
    tokenLength: paymentToken.length,
    environment: target.environment,
    environmentSource: target.source,
    endpointHost: new URL(target.endpoint).host,
  };
  console.info('NMI payment attempt', tokenDiagnostics);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NMI_TIMEOUT_MS);

  try {
    const nmiRes = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: privateApiKey,
      },
      body: JSON.stringify({
        amount: amount.toFixed(2),
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
        ...tokenDiagnostics,
        httpStatus: nmiRes.status,
        response: data?.response,
        responseCode: data?.response_code,
        responseText: data?.response_text,
      });
      return res.status(nmiRes.status >= 400 ? nmiRes.status : 402).json({
        success: false,
        error: errorText(data),
        diagnostic: tokenDiagnostics,
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
    console.error('NMI v5 API request failed:', {
      ...tokenDiagnostics,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(timedOut ? 504 : 500).json({
      success: false,
      error: timedOut
        ? 'The payment processor took too long to respond. Check transaction history before retrying.'
        : 'Failed to process payment. Please try again later.',
      diagnostic: tokenDiagnostics,
    });
  } finally {
    clearTimeout(timeout);
  }
}
