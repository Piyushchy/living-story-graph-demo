import { passwordMatches, sessionCookie } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!passwordMatches(req.body?.password)) return res.status(401).json({ error: "Incorrect password" });
    res.setHeader("Set-Cookie", sessionCookie());
    return res.status(200).json({ authenticated: true });
  } catch {
    return res.status(500).json({ error: "Admin access is not configured" });
  }
}
