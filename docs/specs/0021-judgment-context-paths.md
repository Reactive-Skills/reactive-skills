# Specification: Scoped Judgment Context (#24)

Status: Draft for DoD approval.

## 1. Problem

The Jev adapter sends the whole run context and the event payload as `state` for every judgment.
A criterion about two fields is judged against everything else in the run, and the payload appears twice when the agent also copied it into the context, so the model's answer moves with content the criterion never reads.
In the reported case the same content scored P(yes) 0.38 with the payload copy and 0.64 without it.

## 2. Judgment fields

1. `context_paths` is an optional list of paths read from the run context. The judgment-level field is named `context_paths` because the manifest already has a top-level `context_keys` with a different meaning.
2. `include_payload` is an optional boolean that defaults to `true`. `false` leaves the event payload out of what the adapter sends.
3. A path is dot-separated segments relative to the run context, such as `write_side.deciders`. A numeric segment indexes an array. A leading `context.` is not part of a path.
4. A segment cannot be empty, contain whitespace or brackets, or be `__proto__`, `constructor`, or `prototype`.
5. Only the Jev adapter sends context. The script adapter evaluates the criterion against the full sandbox and ignores both fields.

## 3. What the adapter sends

6. A judgment with neither field set sends `{ event: <payload>, context: <whole run context>, currentState }`, exactly as before.
7. A judgment with `context_paths` sends `context` containing one entry per path that has a value, keyed by the path as written, so `write_side.deciders` arrives as that key rather than as nested objects. The payload and `currentState` are still sent.
8. A judgment with `include_payload: false` omits the `event` key. Alone, it still sends the whole run context.
9. An empty `context_paths` list sends an empty `context`.
10. Duplicate paths are sent once.
11. A path with no value in the run context (a missing segment, a missing array index, an inherited property, or `undefined`) is not sent and is listed as missing. It never fails the judgment. An explicit `null` is a value and is sent.

## 4. Recording

12. When a judgment declares `context_paths` or `include_payload`, the Jev result carries `contextSent` and `GUARD_EVALUATED` records it under `judgment.contextSent`: `paths` (the declared paths that were sent; absent when the whole context was sent), `missing`, `includePayload`, and `inputTokens` when the model's usage reports `input_tokens`.
13. A judgment that declares neither field records no `contextSent`.

## 5. Validation

14. The manifest schema rejects a `context_paths` entry that breaks rule 4 and a `context_paths` or `include_payload` of the wrong type. `validate` reports these as errors.
15. `validate` warns when a path starts with `context.`, and when `context_paths` or `include_payload` is set with `adapter_hint: script`.

## 6. Capability

16. The runtime advertises `judgment.context_paths`.
17. A runtime without it drops `context_paths` and `include_payload` and sends the whole run context and the payload, so a skill that depends on scoped context requires the capability in `runtime_requirements.required_capabilities` and an older runtime refuses it instead of judging with extra context.
18. `validate` warns when a manifest uses `context_paths` or `include_payload` without requiring `judgment.context_paths`.
