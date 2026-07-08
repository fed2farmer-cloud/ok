import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

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

export default async function handler(_req: any, res: any) {
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

    res.status(200).json({
      link_token: response.data.link_token,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
}