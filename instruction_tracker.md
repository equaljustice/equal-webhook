# Instruction files tracker (`equal-webhook`)

This document tracks every prompt under `assets/prompts/`: what each file supports, what it omits, and how closely it follows the **structural contract** used in `upi_fraud.txt` (roadmap, formatting, spacing, JSON protocol, guards, section layout).

**Prompts directory:** `assets/prompts/`  
**Reference baseline (structure):** `upi_fraud.txt`

---

## Structural contract (baseline checklist)

Used to score “aligned” vs “partial”. Domain rules (Q&A text, legal logic) are **not** copied from UPI; only the **shell** is compared.

| # | Element | Purpose |
|---|---------|--------|
| 1 | **INSTRUCTION ROADMAP** | Part 0 checklist + section map at top |
| 2 | **CRITICAL formatting banner** | Absolute precedence over other formatting hints |
| 3 | **Options / Q&A spacing** | Single `<br>` between `(a)(b)(c)`; caps on consecutive `<br>` |
| 4 | **NO EXTRA WHITESPACE & ANTI-GAP** | Dedicated block after “CRITICAL RULES FOR BOTH CATEGORIES” |
| 5 | **JSON — order of reading** | Short “how to read this block” line |
| 6 | **JSON — strict / multilingual** | English keys; `true`/`false`/`null` only; no fences; last line rules |
| 7 | **IRRELEVANT / EXIT guard** | Early exit + JSON consistent with schema |
| 8 | **CRITICAL FLOW GUARD** | Session / payment / (if applicable) `document_ready` — no keyword closure |
| 9 | **CRITICAL DISPLAY NUMBERING** | Integer questions only; what stays unnumbered |
| 10 | **THESE INSTRUCTIONS ARE THE BRAIN** | Sole source of truth |
| 11 | **Section roadmap matches body** | e.g. C = overview, D = executable Q&A, E/F/G as defined |

---

## All prompt files (inventory)

| File | Primary use (short) |
|------|---------------------|
| `upi_fraud.txt` | UPI PIN / QR fraud — multi-doc, RBI/police/RTI |
| `senior_citizen.txt` | Maintenance / tribunal / family notices — multi-doc |
| `salary_non_payment_intructions.txt` | Unpaid wages / PF / TDS / gratuity — multi-doc |
| `emp_termination_intructions.txt` | Employment termination — notice or police complaint |
| `cheque_bouncing.txt` | NI Act notice + optional paid synopsis |
| `will_instructions.txt` | Will drafting + post-signing guidance |
| `side_project_intructions.txt` | Side-project vs employment risk |
| `tax_residency_intructions.txt` | Tax residency assessment |
| `service_bond_intructions.txt` | Service bond assessment |
| `flight_cancellation_intructions.txt` | Flight cancellation compensation |
| `check_will_intructions.txt` | Will review / check flow |
| `pre_nuptial_intructions.txt` | Pre-nuptial agreement path |
| `gst_arrest.txt` | GST arrest / safeguard Q&A and outputs |

---

## Alignment tiers

### Tier 1 — Fully aligned (structural contract)

These include: roadmap, CRITICAL formatting, dedicated NO EXTRA block, JSON order + strict JSON guards, irrelevant guard, CRITICAL FLOW + DISPLAY NUMBERING, brain block, and a Part 0 section map that matches the file’s real sections (where applicable).

| File | JSON: `document_ready` | Payment model | Section pattern (body) | Extra / unique |
|------|-------------------------|---------------|---------------------------|------------------|
| `upi_fraud.txt` | Yes | Repeatable; multi-document | A–F (C overview, D Q&A, E doc gen, F enforcement) | NON-ENGLISH anti-hallucination block; RTI |
| `senior_citizen.txt` | Yes | Repeatable; multi-document | A–F | Tribunal / police paths |
| `salary_non_payment_intructions.txt` | Yes | Repeatable; multi-document | A–F | Employer / authority letters |
| `emp_termination_intructions.txt` | No | Once before final output | A–D (+ E final enforcement in body) | Single combined notice/complaint |
| `cheque_bouncing.txt` | No | Repeatable for **optional** paid cycles | A–E | Notice + optional paid synopsis |
| `will_instructions.txt` | Yes | Once before Will | A–G (E Will logic, F signing/probate, G enforcement) | Optional `document_type` JSON **before** final control JSON per Section E |

### Tier 2 — Partially aligned (legacy pack)

Shared: confidentiality (or variant), CRITICAL formatting, two HTML categories, JSON **without** `document_ready`, payment **once**, irrelevant + CRITICAL FLOW + DISPLAY NUMBERING.

**Missing vs Tier 1:** INSTRUCTION ROADMAP, dedicated **NO EXTRA WHITESPACE** block, JSON **order of reading**, JSON **strict / multilingual** hard guards.

| File | Notes |
|------|--------|
| `side_project_intructions.txt` | Proprietary header wording differs slightly |
| `tax_residency_intructions.txt` | — |
| `service_bond_intructions.txt` | — |
| `flight_cancellation_intructions.txt` | **Section label gap:** D then **G** (no E/F) |
| `check_will_intructions.txt` | Body sections A–D only (no separate final enforcement section) |
| `pre_nuptial_intructions.txt` | — |

### Tier 3 — Outlier

| File | Has | Missing vs Tier 1 |
|------|-----|-------------------|
| `gst_arrest.txt` | CRITICAL formatting; full category spacing; JSON (5 fields, payment once); irrelevant guard; custom SECTION A/B style | Roadmap, NO EXTRA block, JSON order + strict JSON lines, CRITICAL FLOW GUARD, CRITICAL DISPLAY NUMBERING; different “brain” heading typo (“IS THE BRAIN”) |

---

## Feature matrix

| Capability | UPI | Senior | Salary | Emp | Cheque | Will | Tier 2 (6 files) | `gst_arrest.txt` |
|------------|:---:|:------:|:------:|:---:|:------:|:----:|:----------------:|:----------------:|
| `document_ready` in control JSON | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Repeatable payment / multi-output | ✓ | ✓ | ✓ | ✗ | ✓* | ✗ | ✗ | ✗ |
| INSTRUCTION ROADMAP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| NO EXTRA WHITESPACE block | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| JSON order + strictness guards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| CRITICAL FLOW + DISPLAY NUMBERING | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Explicit non-English fidelity block | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

\* **Cheque:** repeatable payment for optional add-on outputs (e.g. synopsis), not the same as UPI’s multi-notice menu.

---

## Backend coupling (reminder)

`src/routes/assistantAPI.js` parses:

- **Control JSON** on every turn: `upload_required`, `upload_type`, `upload_reason`, `session_terminated`, `termination_message`, `payment_required`, and **`document_ready`** when present.
- Optional embedded **`document_type`** JSON for downloads when termination/document-ready paths fire.

Prompts **without** `document_ready` in the schema should never set that field (omit or keep false); the server still accepts the standard fields.

---

## Maintenance

- **Repo vs production:** If prompts are edited in MongoDB via the admin panel, this tracker reflects **files in git** until you re-export or re-sync.
- **Suggested next step for Tier 2 + GST:** add roadmap, NO EXTRA block, and JSON strictness lines to match Tier 1 without changing each product’s legal Q&A.

---

*Last updated from repository scan of `assets/prompts/*.txt`.*
