// HAILMARY Alexa skill — hands-free voice on Echo / Fire devices.
//
// Deploy as an AWS Lambda (Node 18+) or any HTTPS endpoint, set as the skill's
// backend in the Alexa Developer Console. Build one custom intent "AskIntent"
// with a single slot {query} of type AMAZON.SearchQuery (sample: "ask hailmary {query}").
//
// Env: HAILMARY_API_URL (e.g. https://brainiac.<tailnet>.ts.net/api/hailmary)
//      HAILMARY_API_TOKEN (= MEMORY_API_TOKEN)
//
// It's a thin proxy: speech in -> /api/hailmary ask (local-first AI) -> speech out.
function speak(text, end = true) {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: String(text).slice(0, 7000) },
      shouldEndSession: end,
    },
  };
}

export async function handler(event) {
  try {
    const req = (event && event.request) || {};
    if (req.type === "LaunchRequest") return speak("Hailmary here. What do you need?", false);
    if (req.type === "IntentRequest") {
      const intent = req.intent || {};
      if (["AMAZON.StopIntent", "AMAZON.CancelIntent"].includes(intent.name)) {
        return speak("Standing by.");
      }
      const q = intent.slots?.query?.value || "brief";
      const res = await fetch(process.env.HAILMARY_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.HAILMARY_API_TOKEN}`,
        },
        body: JSON.stringify({ op: "ask", query: q, node: "alexa" }),
      });
      const data = await res.json().catch(() => ({}));
      return speak(data.text || "I could not reach the brain.");
    }
    return speak("Goodbye.");
  } catch {
    return speak("Something went wrong reaching Hailmary.");
  }
}
