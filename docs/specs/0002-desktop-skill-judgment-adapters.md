# Desktop Skill Judgment Adapters

Status: Approved.

## Intent

Add structured judgment contracts and semantic model tiers to the canonical Desktop `client-intake`, `slice-architect`, and `platform-assessment` reactive skills.

The change makes completion evidence explicit while preserving the existing human review gates.

## Scope

The implementation changes only the three canonical skill directories under `C:\Users\brand\Desktop\skills`.

Consumer satellites are not synchronized in this slice.

## Design Decision

Preserve the existing state topology.

Add judgment contracts to the existing approval transitions rather than introducing parallel review states.

Route failed or low-confidence judgments back to the existing human review state for the skill.

Add per-state model capability tiers where the work requires fast inspection, balanced drafting, decision support, or deeper reasoning.

Add structured evidence requirements to the state prompts that feed the judgments.

Add `STATECHART.md` diagrams because these canonical skills currently lack statechart documentation.

## Skill Contracts

### client-intake

Assessment, scope, and commercial states must emit structured evidence for constraints, MVP boundaries, milestones, timeline, and commercial model.

The proposal approval judgment requires non-empty KPI, MVP scope, milestone, and commercial-model records before completion.

Failed or low-confidence approval routes back to `PROPOSAL_REVIEW_GATE`.

### slice-architect

Each vertical slice must include its surface, handler and port, pure domain decider, projection, adapter, and evidence.

The prioritization record must include non-empty Q1 MVP evidence and assign every slice to an Eisenhower quadrant.

The approval judgment requires a non-empty slice set and Q1 MVP set before completion.

Failed or low-confidence approval routes back to `REVIEW_GATE`.

### platform-assessment

Each pillar audit must record findings and evidence.

Triage must record numeric pillar scores, invariants, and remediation targets or an explicit audit-only decision.

The approval judgment requires a complete scorecard and findings ledger before completion.

Failed or low-confidence approval routes back to `REPORT_DELIVERY`.

## Acceptance Criteria

1. All three `skill.yaml` manifests parse successfully.
2. Each judgment declares an explicit criterion, confidence threshold, adapter fallback, and review fallback target.
3. State prompts emit the fields consumed by their judgment contracts.
4. Each skill has a `STATECHART.md` matching its manifest topology and judgment edges.
5. Existing human review gates remain available for ambiguous or failed judgments.
6. Focused AXI inspection, diff checks, documentation checks, prose checks, and the full test suite pass.
7. No consumer satellite is modified before explicit sync approval.

## Non-Requirements

This slice does not introduce new states.

This slice does not change deliverable projection paths.

This slice does not add provider-specific model identifiers.

This slice does not auto-approve client proposals, architecture plans, or audit reports.
