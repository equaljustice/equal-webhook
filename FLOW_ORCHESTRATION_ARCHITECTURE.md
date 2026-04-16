# Deterministic Q&A Flow Orchestration Architecture

## Why this document exists

Current assistant behavior relies on LLM-led branching ("if Qx -> option b, ask Qy"). This causes non-deterministic failures:

- Premature `session_terminated` or `payment_required`
- Wrong branch transitions in multi-path flows
- Prompt text edits by admins/lawyers accidentally changing execution behavior

This document captures a production architecture to make question routing deterministic while preserving lawyer control over legal language and branch design via a graph UI.

---

## Goals

1. Deterministic question routing (no LLM hallucinated branch jumps)
2. Hard backend guardrails for termination and payment gates
3. Lawyer-editable branching through a frontend graph playground
4. Versioned draft/review/publish workflow with rollback
5. Backward-compatible rollout from prompt-only flows

---

## Non-goals

- Replacing LLM final drafting for notices/assessments
- Rebuilding payment infrastructure (existing payment routes remain)
- Rewriting all assistants in one release

---

## High-level design

Two-layer model per assistant:

1. **Flow layer (deterministic):**
   - Nodes, edges, conditions, state transitions
   - Payment gate and termination eligibility
   - Validated and executed only by backend

2. **Content layer (lawyer-authored):**
   - Question phrasing, option labels, legal paragraphs, disclaimers
   - Referenced by `contentKey` from flow nodes

LLM role:

- Render/translate question text and final documents
- **Never** decide next node, payment timing, or termination timing

---

## Runtime state machine

Each session has a server-side `flowState`:

- `qa_in_progress`
- `waiting_payment`
- `ready_for_final_output`
- `final_output_generated`
- `terminated`

Hard rules:

- `payment_required=true` allowed only in `waiting_payment`
- `session_terminated=true` allowed only after `final_output_generated`
- Illegal model flags are overridden and logged

---

## Data model additions

Extend session document with:

- `flowKey: string`
- `flowVersion: number`
- `flowState: string`
- `currentNodeId: string`
- `answers: object` (map nodeId -> normalized answer)
- `askedNodeOrder: string[]` (for runtime numbering/UI timeline)
- `paymentGateShown: boolean`
- `flowAudit: object[]` (optional, transition logs)

No existing fields removed (`isPaid`, `price`, `messages`, etc. remain).

---

## Flow JSON contract (summary)

Top-level:

- `flowKey`, `version`, `startNodeId`
- `nodes` map
- `guards`
- `states`
- `templates` (optional references)

Node types:

- `question` (single_select, multi_select, text, number)
- `router` (condition-based branching)
- `message` (informational)
- `state_change` (e.g., payment gate)
- `final_output_generator`
- `terminate`

Key design choice:

- Use stable unique IDs (`salary_np_core_employment_status`) instead of `Q1/Q2`.
- Compute display numbering at runtime from `askedNodeOrder`.

---

## Content model

Store lawyer-editable text separately:

- `assistant_content` document/file:
  - `contentKey -> localized text payload`
  - Question labels/options
  - Legal boilerplate and drafting templates

Flow nodes reference `contentKey` rather than embedding large legal text directly.

---

## Admin/lawyer editing model

### Graph playground (frontend)

Lawyer can:

- Add/edit/remove nodes
- Connect branches
- Configure branch conditions
- Mark terminal nodes
- Mark payment gate stage
- Edit linked content keys

### Draft -> validate -> publish

1. Save draft
2. Run validator
3. Run simulator (path tests)
4. Publish version
5. Rollback support

---

## Validation rules (must pass before publish)

Graph integrity:

- Exactly one start node
- Every edge target exists
- No orphan nodes (unless explicitly archived)
- No dead-end non-terminal nodes
- Decision/router branch completeness

Policy integrity:

- Payment gate reachable only in allowed phase
- Terminal nodes cannot require payment
- No conflicting directives on same node
- Optional cycle restrictions (or explicit loop-safe flags)

Schema integrity:

- Valid node types/fields
- Condition expression schema checks

---

## API plan (flow management)

New backend routes (suggested):

- `GET /api/flow-admin/:assistantKey` (get draft/published)
- `POST /api/flow-admin/:assistantKey/draft` (save draft)
- `POST /api/flow-admin/:assistantKey/validate` (lint + rule checks)
- `POST /api/flow-admin/:assistantKey/simulate` (path simulation)
- `POST /api/flow-admin/:assistantKey/publish` (publish version)
- `POST /api/flow-admin/:assistantKey/rollback/:version` (rollback)

Audit fields:

- `updatedBy`, `updatedAt`, `publishedBy`, `publishedAt`, `changeSummary`

---

## Runtime API behavior (chat)

At `/assistant/send-message`:

1. Load session flow context
2. Validate incoming answer against current node
3. Compute next node deterministically
4. Return next question/message from content layer
5. If payment gate reached -> set `flowState=waiting_payment`, return `paymentRequired=true`, include `paymentAmount=session.price`
6. If final generation stage reached and paid -> invoke LLM for final document only
7. Terminate only per flow-state policy

Response envelope should include:

- `nodeId`
- `displayNumber`
- `phase`
- `reply`
- `paymentRequired`
- `paymentAmount`
- `sessionTerminated`
- `terminationMessage`

---

## Guardrail behavior vs model output

If model output metadata conflicts with flow state:

- Override to legal values
- Persist corrected flags only
- Log violation event:
  - assistantKey
  - sessionId
  - nodeId
  - model flags
  - overridden flags

This enables post-release monitoring.

---

## Migration plan

### Phase 1: `salary_non_payment` only

- Build flow + content for one assistant
- Run in deterministic mode for this key only
- Keep existing prompt flow for all others

### Phase 2: high-risk assistants

- `gst_arrest`
- `service_bond`
- others

### Phase 3: deprecate fallback parsing

- Remove regex/keyword fallback for termination/payment decisions
- Enforce strict metadata and state machine

---

## Testing strategy

### Unit tests

- Flow validator
- Condition evaluator
- Transition engine
- Runtime numbering

### Integration tests

- Every branch path in `salary_non_payment`
- Invalid option retry behavior
- No payment before gate
- Early termination path skips payment
- Payment gate -> paid -> final output -> termination

### Simulation tests (admin tool)

- Given answer sequences, verify exact node trace and final state

---

## Observability

Track metrics:

- `flow_validation_failures`
- `illegal_model_flag_overrides`
- `unexpected_termination_prevented`
- `payment_gate_trigger_count`
- `path_coverage_by_assistant`

Store transition logs for debugging:

- `fromNode`, `answer`, `toNode`, `flowState`, timestamp

---

## Security and permissions

Role-based capabilities:

- Lawyer: edit content, edit flow draft (if enabled)
- Reviewer/Admin: publish/rollback
- System: enforce runtime policies

All publish actions must be audited with diff snapshots.

---

## Open decisions

1. Should lawyers edit raw JSON directly, or only graph builder UI?
2. Are cycles allowed in any assistant flows?
3. Should content be multilingual in one doc or per-language docs?
4. Should we require reviewer approval for every publish in production?

---

## Recommended next step

Implement Phase 1 with `salary_non_payment`:

1. Introduce session flow fields
2. Build flow validator + engine
3. Add flow admin draft/validate/publish endpoints
4. Wire send-message deterministic routing for this assistant key
5. Ship with simulation and transition logs

