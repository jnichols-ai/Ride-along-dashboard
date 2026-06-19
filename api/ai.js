// Serverless proxy for the AI insight / synopsis features (previously window.cowork.askClaude
// inside Cowork). Calls Anthropic's API directly using ANTHROPIC_API_KEY, kept server-side.
// Accepts { prompt, data } — data is any JSON-serializable payload of stats the dashboard
// already computed client-side; it gets appended to the prompt as context.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server. Add it in Vercel → Project Settings → Environment Variables." });
    return;
  }

  try {
    const { prompt, data } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    const userContent = (data !== undefined && data !== null)
      ? `${prompt}\n\nData:\n${JSON.stringify(data, null, 2)}`
      : prompt;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const json = await aiRes.json();
    if (json.error) {
      res.status(502).json({ error: json.error.message || "Anthropic API error" });
      return;
    }
    const text = (json.content || []).map(c => c.text || "").join(" ").trim();
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
