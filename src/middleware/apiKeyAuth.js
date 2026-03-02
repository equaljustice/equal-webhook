/**
 * API Key Authentication Middleware
 * Checks for API key in request headers
 */

export const apiKeyAuth = (req, res, next) => {
  // Get API key from environment
  const requiredApiKey = process.env.PROMPT_ADMIN_API_KEY;

  if (!requiredApiKey) {
    return res.status(500).json({
      error: "API key not configured on server",
      message: "PROMPT_ADMIN_API_KEY environment variable is not set",
    });
  }

  // Get API key from request header
  // Check both 'x-api-key' and 'authorization' headers
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["x-apikey"] ||
    (req.headers["authorization"] &&
      req.headers["authorization"].replace(/^Bearer\s+/i, ""));

  if (!apiKey) {
    return res.status(401).json({
      error: "API key required",
      message:
        "Please provide API key in 'X-API-Key' header or 'Authorization: Bearer <key>' header",
    });
  }

  // Compare API keys (use constant-time comparison to prevent timing attacks)
  if (apiKey !== requiredApiKey) {
    return res.status(403).json({
      error: "Invalid API key",
      message: "The provided API key is not valid",
    });
  }

  // API key is valid, proceed
  next();
};
