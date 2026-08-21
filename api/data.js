import { get, put } from "@vercel/blob";
import { authenticated } from "../lib/auth.js";

const PATHNAME = "living-story-graph/data.json";

// The blob SDK's own message names environment variables, which is no use to the person holding
// the editor open. Say what is actually wrong and where it is put right.
const NO_STORE = /no blob credentials|BLOB_READ_WRITE_TOKEN|BLOB_STORE_ID/i;
function describe(error, fallback) {
  const message = error?.message || fallback;
  return NO_STORE.test(message)
    ? "No Blob store is connected to this project yet, so there is nowhere to publish to. Connect one under Storage in the Vercel dashboard and redeploy — the access token is added for you."
    : message;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const result = await get(PATHNAME, { access: "private" });
      if (!result || result.statusCode !== 200) return res.status(404).json({ error: "No hosted data yet" });
      const payload = JSON.parse(await new Response(result.stream).text());
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json(payload);
    } catch (error) {
      return res.status(503).json({ error: describe(error, "Hosted data unavailable") });
    }
  }

  if (req.method === "PUT") {
    res.setHeader("Cache-Control", "no-store");
    if (!authenticated(req)) return res.status(401).json({ error: "Admin login required" });
    const payload = req.body;
    if (!payload || !Array.isArray(payload.entities) || !Array.isArray(payload.events) || !Array.isArray(payload.volumes)) {
      return res.status(400).json({ error: "Invalid story graph data" });
    }
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized) > 8_000_000) return res.status(413).json({ error: "Data file is too large" });
    try {
      const blob = await put(PATHNAME, serialized, { access: "private", allowOverwrite: true, contentType: "application/json", addRandomSuffix: false });
      return res.status(200).json({ saved: true, updatedAt: new Date().toISOString(), url: blob.url });
    } catch (error) {
      return res.status(503).json({ error: describe(error, "Data could not be saved") });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
