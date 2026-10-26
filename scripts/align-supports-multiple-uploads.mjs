/**
 * Align Assistant.config.supportsMultipleUploads with prompt upload semantics.
 *
 * Rule:
 *   true  → prompt asks user to select MULTIPLE files in ONE upload turn
 *   false → no upload, single file per turn, or sequential one-file-at-a-time
 *
 * Usage (from equal-webhook/):
 *   node scripts/align-supports-multiple-uploads.mjs           # dry-run
 *   node scripts/align-supports-multiple-uploads.mjs --apply   # write Mongo
 *
 * Requires MONGO_URI + DB_NAME (see .env). Does NOT deploy to Cloud Run.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/**
 * Recommended flag keyed by assistant.key (Mongo).
 * Derived from assets/prompts/* upload wording (see script header rule).
 */
export const RECOMMENDED_SUPPORTS_MULTIPLE_UPLOADS = {
  // MULTI — one turn, select all available files
  "ff-reconciliation-notice": true,

  // SINGLE — one document per upload turn (or sequential one-at-a-time)
  "check-my-rent-agreement": false,
  check_my_will: false,
  side_project: false,
  service_bond: false, // prompt: after EACH upload, request NEXT (sequential)
  "get-security-deposit": false,
  "tenant-eviction-rent-recovery": false,
  "goa-inheritance-guide": false,
  sir_assessment: false, // notice / review upload wording is singular or checklist tip

  // NO real domain upload ask (protocol boilerplate only, or drafting-only)
  "cheque-bounce": false,
  create_my_will: false,
  emp_termination: false,
  flight_cancellation: false,
  "gst-arrest": false,
  "interitance-guide": false,
  "livein-agreement": false,
  "make-my-nda": false,
  "make-my-rent-agreement": false,
  "marriage-gift-planning": false,
  "pre-nuptial-agreement": false,
  salary_non_payment: false,
  "senior-citizen-rights": false,
  tax_residency: false, // had true in Mongo; prompt has no multi/batch upload ask
  "upi-frauds": false,

  // Legacy OpenAI shells — no Gemini prompt asset; keep single/false
  "legacy-airline-baggage": false,
  "legacy-boarding-denied": false,
  "legacy-draft-will": false,
  "legacy-employment-termination": false,
  "legacy-non-disclosure-agreement": false,
};

function promptSays(key) {
  const multi = RECOMMENDED_SUPPORTS_MULTIPLE_UPLOADS[key];
  if (multi === true) return "MULTI (batch files in one turn)";
  if (multi === false) {
    if (key === "service_bond") return "SEQUENTIAL single (bond→contract→notice)";
    if (
      [
        "check-my-rent-agreement",
        "check_my_will",
        "side_project",
        "get-security-deposit",
        "tenant-eviction-rent-recovery",
        "goa-inheritance-guide",
        "sir_assessment",
      ].includes(key)
    ) {
      return "SINGLE (one file per upload turn)";
    }
    return "NO / unused upload (keep false)";
  }
  return "(not in recommended map)";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "equalJustice";
  if (!uri) {
    console.error("MONGO_URI / MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName });
  console.log(`db=${mongoose.connection.db.databaseName}  mode=${apply ? "APPLY" : "DRY-RUN"}\n`);

  const assistants = await mongoose.connection.db
    .collection("assistants")
    .find({})
    .toArray();

  console.log(
    [
      "assistantKey".padEnd(36),
      "promptSays".padEnd(42),
      "current".padEnd(14),
      "recommended".padEnd(12),
      "action",
    ].join(" | ")
  );
  console.log("-".repeat(120));

  const updates = [];
  for (const a of assistants.sort((x, y) =>
    String(x.key).localeCompare(String(y.key))
  )) {
    const key = a.key;
    const current =
      a.config?.supportsMultipleUploads === true
        ? true
        : a.config?.supportsMultipleUploads === false
          ? false
          : null; // unset → runtime false
    const recommended = Object.prototype.hasOwnProperty.call(
      RECOMMENDED_SUPPORTS_MULTIPLE_UPLOADS,
      key
    )
      ? RECOMMENDED_SUPPORTS_MULTIPLE_UPLOADS[key]
      : null;

    let action = "skip";
    if (recommended === null) {
      action = "NO_RECOMMENDATION";
    } else if (current === recommended) {
      action = "ok";
    } else if (current === null && recommended === false) {
      action = "ok(unset≡false)"; // runtime already false; optional explicit set
    } else {
      action = apply ? "UPDATED" : "WOULD_UPDATE";
      updates.push({ key, from: current, to: recommended });
    }

    console.log(
      [
        String(key).padEnd(36),
        promptSays(key).padEnd(42),
        String(current === null ? "(unset→false)" : current).padEnd(14),
        String(recommended === null ? "?" : recommended).padEnd(12),
        action,
      ].join(" | ")
    );
  }

  if (apply && updates.length) {
    for (const u of updates) {
      await mongoose.connection.db.collection("assistants").updateOne(
        { key: u.key },
        { $set: { "config.supportsMultipleUploads": u.to } }
      );
      console.log(`\n✓ ${u.key}: ${u.from} → ${u.to}`);
    }
  } else if (!apply && updates.length) {
    console.log(`\n${updates.length} mismatch(es). Re-run with --apply to write.`);
  } else {
    console.log("\nNo mismatches requiring write.");
  }

  console.log(
    "\nNote: existing chat sessions keep their snapshotted supportsMultipleUploads; new sessions pick up config."
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
