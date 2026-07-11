export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apn, county, state } = req.body;

  if (!apn || !county || !state) {
    return res.status(400).json({
      error: "APN, county and state are required.",
    });
  }

  return res.status(200).json({
    success: true,
    property: {
      apn,
      county,
      state,
      owner: "Demo Owner",
      acreage: 20,
      assessedValue: 400000,
      estimatedMarketValue: 500000,
      lienStatus: "No known liens",
      ownershipVerified: true,
      maxLoanAmount: 250000,
    },
  });
}