import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "story_admin";

function secret() {
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not configured");
  return process.env.ADMIN_PASSWORD;
}

function signature() {
  return createHmac("sha256", secret()).update("living-story-graph-admin-v1").digest("hex");
}

export function passwordMatches(value) {
  const supplied = Buffer.from(String(value || ""));
  const expected = Buffer.from(secret());
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function authenticated(req) {
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map(part => part.trim().split(/=(.*)/s).slice(0, 2)));
  const supplied = Buffer.from(String(cookies[COOKIE_NAME] || ""));
  const expected = Buffer.from(signature());
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function sessionCookie() {
  return `${COOKIE_NAME}=${signature()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}
