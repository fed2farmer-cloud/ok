import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV || "sandbox";

  if (!clientId) {
    return res.status(500).json({
      error: "Missing PLAID_CLIENT_ID in Vercel Environment Variables",
    });
  }

  if (!secret) {
    return res.status(500).json({
      error: "Missing PLAID_SECRET in Vercel Environment Variables",
    });
  }

  const basePath =
    PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] ||
    PlaidEnvironments.sandbox;

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  const plaidClient = new PlaidApi(configuration);

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: "securedlanding-user",
      },
      client_name: "SecuredLanding",
      products: [Products.Auth],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return res.status(200).json({
      link_token: response.data.link_token,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
}