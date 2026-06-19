// Serverless proxy for monday.com's GraphQL API. Keeps the real API token server-side
// (set as the MONDAY_API_TOKEN environment variable in Vercel) instead of shipping it to
// the browser. The dashboard's frontend calls this with the exact { query, variables }
// shape it used to pass straight to the Cowork monday connector.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: "MONDAY_API_TOKEN is not set on the server. Add it in Vercel → Project Settings → Environment Variables." });
    return;
  }

  try {
    const { query, variables } = req.body || {};
    if (!query) {
      res.status(400).json({ error: "Missing GraphQL query" });
      return;
    }
    const parsedVariables = typeof variables === "string" ? JSON.parse(variables) : variables;

    const mondayRes = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        "API-Version": "2024-01",
      },
      body: JSON.stringify({ query, variables: parsedVariables }),
    });

    const json = await mondayRes.json();
    if (json.errors) {
      res.status(502).json({ error: json.errors.map(e => e.message).join("; ") });
      return;
    }
    res.status(200).json(json.data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
