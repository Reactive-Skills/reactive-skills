# Judgment input selection and local preconditions

Judgments can opt into nested payload selection and pure local validation before adapter selection.
Existing judgments retain their input, flat `context_paths` representation, judgment-before-guard order, fallback behavior and approval behavior.

```yaml
runtime_requirements:
  required_capabilities: [judgment.payload_selection]
states:
  REVIEW:
    transitions:
      CHECK:
        target: DONE
        judgment:
          type: predicate
          criterion: Does event.check.text satisfy context["review.rubric"]?
          adapter_hint: jev
          min_probability: 0.9
          context_paths: [review.rubric]
          required_context_paths: [review.rubric]
          payload_paths: [check.text, check.revision]
          precondition:
            payload_schema:
              exit_code: {type: number, const: 0}
              check.text: {type: string}
              check.revision: {type: string}
```

The capability requirement is mandatory for a manifest that uses any of the new fields, including inside nested states.
Preflight rejects malformed declarations and a missing capability requirement.

`payload_paths` selects paths relative to the submitted payload.
The selected values keep their nesting: `check.text` arrives as `event.check.text`.
Array indices keep their positions, with unselected positions serialized as `null`.
Numeric segments must use canonical indices between 0 and 10000, limiting sparse-array expansion.
Selecting a parent includes its complete subtree; selecting overlapping children does not modify the source.
Every selected payload path is required.
An empty list sends an empty event object.
Omitting the field retains the full payload when payload inclusion is enabled.
Combining it with `include_payload: false` is invalid.

`context_paths` keeps its existing flat dot-path keys.
Missing context paths remain optional unless listed in `required_context_paths`.
A required context path must be inside the declared selection when `context_paths` is present.
An explicit `null` counts as present; an absent or undefined value does not.
No missing or invalid selection falls back to full-context input.

`precondition.payload_schema` maps required payload paths to a type and an optional primitive `const` value.
Supported types are `string`, finite `number`, `boolean`, non-null `object`, `array` and `null`.
This is a small declarative validation format, not arbitrary JavaScript or a complete JSON Schema implementation.
It reads the original submitted payload locally and cannot execute custom guard code, mutate run context or contact an adapter.
A failed precondition or required-input check refuses locally with `judgmentSkipped: true`, `band: reject` and zero adapter attempts.
It does not take the judgment's fallback target or create a human-approval request.
Existing HSM bubbling and subsequent guard handling continue unchanged.

For an opt-in judgment, selection applies before both primary and fallback adapter calls, including custom adapters' evaluation context and request `contextSnapshot`.
Jev sends the same selected state without applying flat context scoping twice.
The original event remains in the existing signal ledger; it is not replaced by the selected view.

## Inspection and audit

Inspect candidate input without starting a run or contacting an adapter:

```sh
reactive-skills-axi inspect ./skills/example --judgment-input @candidate.json
```

The candidate file contains `{"context":{...},"payload":{...}}`.
The command inspects judgments in every state, including ancestor and nested transitions.
The runtime API `inspectJudgmentInput(judgment, evaluationContext)` provides the same content-free view for one judgment.
Neither interface imports custom guards or configures an adapter.

The view lists adapter policy and destination class (`local`, `remote`, `adapter_defined` or `runtime_selected`), fallback policy, selected paths, missing required fields, errors, precondition status, candidate state byte count and `fullEvent`.
`fullEvent` means the whole submitted payload is eligible for inclusion, rather than selected paths or payload omission.
It does not mean a refused judgment made a request.
Destination classes describe adapter policy, not a resolved endpoint or provider retention guarantees.
`byteCount` counts UTF-8 bytes of JSON candidate state (`event`, `context`, `currentState`); it excludes questions, SDK framing, model configuration and credentials.
It can be nonzero for a locally refused candidate and is zero when invalid declarations prevent state construction.

New judgments record this view in `JudgmentResult.inputInspection`, including success, local refusal, adapter rejection, outage and runtime faults.
Without a whole-cascade deadline, a runtime fault in the judgment path, such as a failing adapter selection, refuses the signal with `band: reject` and does not create a human-approval request.
The existing `GUARD_EVALUATED` event persists it without an additional ledger append or selected-content audit copy.
Replay, snapshots and idempotent resubmissions consume the recorded result without invoking adapters again.
Fresh submissions do not cache semantic results, either within a run or across runs.

Opt-in human approvals bind to a hash of the selected evidence, judgment declaration, `TYPESAFE_BASE_URL` and `TYPESAFE_DEFAULT_MODEL`.
Changing selected evidence, criterion, options, rubric, threshold, adapter, base URL or model requires a fresh decision.
Credentials and log level are not part of the identity, so `approve` accepts the pending request from a terminal with a missing or rotated `TYPESAFE_API_KEY` or a different `TYPESAFE_LOG_LEVEL`, and no secret-derived value is written to the ledger.
A subsequent submission with a new evidence revision cannot inherit a previous human decision.
Custom adapters should put their configuration revision in selected recorded context so approval identity includes it.
Legacy human approvals retain their existing matching rules.

## Performance and verification

Selection and serialization cost O(p² + p*d + b), where p is the selected path count, d is path depth and b is selected input bytes.
No event-history scan or semantic cache is added to judgment preparation.
Selecting evidence can reduce request bytes; it does not establish a remote latency improvement.
Wire-request tests use a mocked SDK and assert that unrelated context and unselected payload subtrees are absent.
Durability tests cover acceptance, local refusal and outage through replay and snapshots.
No live provider latency or billing measurement is claimed.
