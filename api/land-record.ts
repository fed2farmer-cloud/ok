export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apn, county, state } = req.body;

  try {
    const response = await fetch("https://YOUR_REPORTALL_ENDPOINT", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REPORTALL_API_KEY}`,
      },
      body: JSON.stringify({
        apn,
        county,
        state,
      }),
    });

    const data = await response.json();

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
}