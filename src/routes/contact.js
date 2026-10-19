import express from "express";
import { LegalHelpRequest } from "../model/legalHelpRequest.model.js";

const router = express.Router();

/** Default off; set JOLLYJI_CONTACT_ENABLED=true to expose the contact route. */
export function isContactEnabled() {
  const v = process.env.JOLLYJI_CONTACT_ENABLED;
  return v === "true" || v === "1";
}

// Same patterns as jollyji src/lib/contact.functions.ts (zod v3 email regex).
const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

/** Optional string: undefined/null/"" -> undefined; non-string -> false. */
function optionalTrimmed(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return false;
  const s = value.trim();
  return s ? s : undefined;
}

function requiredTrimmed(value) {
  return typeof value === "string" ? value.trim() : null;
}

/**
 * Mirrors jollyji's zod schema; first failing rule wins (schema order).
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function validateLegalHelpRequest(body = {}) {
  const fail = (error) => ({ ok: false, error });

  const question = requiredTrimmed(body.question);
  if (question === null || question.length < 10) {
    return fail("Please describe your legal question (at least 10 characters).");
  }
  if (question.length > 3000) {
    return fail("Please keep your question under 3000 characters.");
  }

  const city = requiredTrimmed(body.city);
  if (city === null || city.length < 2) return fail("Please enter your city.");
  if (city.length > 100) return fail("City must be at most 100 characters.");

  const state = requiredTrimmed(body.state);
  if (state === null || state.length < 2) return fail("Please enter your state.");
  if (state.length > 100) return fail("State must be at most 100 characters.");

  const pincode = requiredTrimmed(body.pincode);
  if (pincode === null || !PINCODE_RE.test(pincode)) {
    return fail("Please enter a valid 6-digit pincode.");
  }

  const email = optionalTrimmed(body.email);
  if (email === false || (email !== undefined && (!EMAIL_RE.test(email) || email.length > 255))) {
    return fail("Please enter a valid email address.");
  }

  const phone = optionalTrimmed(body.phone);
  if (phone === false || (phone !== undefined && !PHONE_RE.test(phone))) {
    return fail("Please enter a valid 10-digit Indian mobile number.");
  }

  if (!email && !phone) {
    return fail("Please provide either your email ID or your mobile number.");
  }

  return {
    ok: true,
    data: {
      question,
      city,
      state,
      pincode,
      email: email ?? null,
      phone: phone ?? null,
    },
  };
}

/**
 * JollyJi contact form. Public (no auth). Flag off -> falls through to the
 * app's default 404, identical to today.
 */
router.post("/legal-help-request", async (req, res, next) => {
  if (!isContactEnabled()) return next();

  const result = validateLegalHelpRequest(req.body ?? {});
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }

  try {
    await LegalHelpRequest.create({ ...result.data, source: "jollyji" });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[legal-help-request] insert failed", err.message);
    return res.status(500).json({
      ok: false,
      error: "We could not send your question right now. Please try again.",
    });
  }
});

export default router;
