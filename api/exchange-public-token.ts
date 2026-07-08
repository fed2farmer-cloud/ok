import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: "Missing public_token" });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    res.status(200).json({
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
}