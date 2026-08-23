# Common control protocol (prompts only)

No frontend or server changes. Shared rules live in prompt assets so every use-case speaks the same flags.

## Status

**Applied to all 23 use-case `.txt` files** via `scripts/apply-common-protocol.mjs`, then body cleanup via `scripts/cleanup-prompt-bodies.mjs` (removes duplicated JSON/format/upload/payment-barrier sections from the body).

## Files

| File | Role |
|------|------|
| `_common_control_protocol.txt` | Canonical shared rules (source for the paste) |
| `_payment_checkpoints.examples.txt` | Checkpoint patterns |
| `_upload_protocol_block.txt` | Included when use-case uploads docs |
| `_document_selection_protocol_block.txt` | Included when use-case has doc menus |
| `_language_selection_block.txt` | Shared language-selection step (prepended in header) |
| `_document_language_block.txt` | Shared document language choice (session vs English) for document-producing use-cases |
| `../scripts/apply-common-protocol.mjs` | Re-runnable applicator |
| `../scripts/cleanup-prompt-bodies.mjs` | Strips duplicate control sections from prompt bodies |
| `../scripts/audit-prompts.mjs` | Automated consistency checks (run after edits) |
| `../scripts/fix-prompt-audit.mjs` | Applies known cross-file fixes from audit |

## Canonical flags

- `batch_form` — 2+ questions in one message  
- `multi_select` — select-all (JSON and/or per-question HTML span)  
- `payment_required` — only at `PAYMENT_CHECKPOINTS`  
- `upload_*` — upload turns  
- `session_terminated` / `termination_message`  

Never set `document_ready` (server infers).

## Error handling

Generic invalid-answer / partial-batch rules live in `_common_control_protocol.txt` under `📌 ERROR HANDLING`.
Do **not** add a separate `SECTION B – ERROR HANDLING` in the body unless this use-case has **extra** rules (word limits, date format, eligibility exits) — put those under the relevant question, not a generic repeat block.

## Tier-1 shared behavior (Q&A flow, role, termination, language)

Also in `_common_control_protocol.txt`:

- `📌 Q&A FLOW` + per-file `📌 Q&A MODE FOR THIS USE-CASE: batch | sequential` (set in `apply-common-protocol.mjs` → `QA_MODE`)
- `📌 ROLE / MODE`, `📌 VERBATIM TEXT`, `📌 TERMINATION`, `📌 FORMATTING CONTRACT`
- Language step: `_language_selection_block.txt` (prepended after checkpoints)

Body keeps: greeting, persona line, closing message wording (`📌 CLOSING MESSAGE`), questions, checkpoints narrative, document templates.

Do **not** duplicate in the body: language list, generic “Therefore: no empathy…”, strict one-question-at-a-time boilerplate, termination JSON mechanics, “Formatting is fully governed…”, or per-question “Wait for user ans Qn” lines.

## Tier-2 shared behavior (document language, wait-line bloat, payment narrative)

- Document language: `_document_language_block.txt` (included by apply for document-producing use-cases listed in `DOC_LANGUAGE_FILES`)
- Body document-language paragraphs / `DOCUMENT LANGUAGE RULES` → replace with `Apply 📌 DOCUMENT LANGUAGE rules…`
- Per-question “Wait for the user to ans/complete/…” sequencing lines → strip (covered by `📌 Q&A FLOW`)
- Remaining “you MUST trigger the payment barrier” / “Inform user: …payment…” narrative → strip; keep checkpoint pointer + domain unlock content

## After editing `_common_control_protocol.txt`

```bash
node scripts/apply-common-protocol.mjs
node scripts/cleanup-prompt-bodies.mjs
```

Then re-upload changed prompts in admin.

## Conflict rule

If a body “PAYMENT BARRIER” narrative disagrees with `PAYMENT_CHECKPOINTS` at the top → **checkpoints win**.
