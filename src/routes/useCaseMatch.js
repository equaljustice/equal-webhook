import express from "express";
import { Assistant } from "../model/assistant.model.js";
import {
  isMatchUseCaseEnabled,
  isChatAvailableAssistant,
  toCandidate,
  matchUseCase,
  MATCH_PROBLEM_MAX_CHARS,
} from "../services/useCaseMatcher.js";

const router = express.Router();

/**
 * Free-text problem -> one chat-available assistant key (or null).
 * Public (no auth), like /listall. Flag off -> falls through to the app's
 * default 404, so the route is invisible until JOLLYJI_MATCH_USE_CASE_ENABLED.
 */
router.post("/match-use-case", async (req, res, next) => {
  if (!isMatchUseCaseEnabled()) return next();

  const problem = req.body?.problem;
  if (typeof problem !== "string" || !problem.trim()) {
    return res.status(400).json({ ok: false, error: "problem is required" });
  }
  if (problem.length > MATCH_PROBLEM_MAX_CHARS) {
    return res.status(400).json({
      ok: false,
      error: `problem must be at most ${MATCH_PROBLEM_MAX_CHARS} characters`,
    });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ ok: false, error: "Matcher unavailable" });
  }

  let candidates;
  try {
    const rows = await Assistant.find({ provider: "gemini" })
      .select("key name description provider config")
      .lean();
    candidates = rows.filter(isChatAvailableAssistant).map(toCandidate);
  } catch (err) {
    console.error("[match-use-case] assistant lookup failed", err.message);
    return res.status(500).json({ ok: false, error: "Failed to load use cases" });
  }

  try {
    const key = await matchUseCase(problem.trim(), candidates);
    return res.status(200).json({ ok: true, key });
  } catch (err) {
    console.error("[match-use-case] Gemini match failed", err.message);
    return res.status(502).json({ ok: false, error: "Matcher failed" });
  }
});

export default router;
