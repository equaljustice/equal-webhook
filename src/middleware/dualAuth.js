import { apiKeyAuth } from "./apiKeyAuth.js";
import { adminAuth } from "./adminAuth.js";

/**
 * Dual authentication middleware that accepts either:
 * 1. API Key authentication (existing method)
 * 2. Admin JWT authentication (new method for admin panel)
 */
export const dualAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

  // If request includes a JWT, skip API-key auth entirely.
  // Otherwise, apiKeyAuth will treat the Bearer token as an API key and respond 403.
  const looksLikeJwt = bearerToken && bearerToken.split(".").length === 3;
  if (looksLikeJwt) {
    return adminAuth(req, res, next);
  }

  // Try API key authentication first
  apiKeyAuth(req, res, (err) => {
    if (!err) {
      return next();
    }

    // Fallback to admin JWT authentication
    return adminAuth(req, res, next);
  });
};
