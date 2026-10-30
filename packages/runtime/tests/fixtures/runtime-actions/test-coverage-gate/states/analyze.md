# ANALYZE

Compare metrics with thresholds and identify gaps.

## Actions
1. Calculate each metric percentage.
2. Compare each metric with its configured threshold.
3. List files, functions, or branches that miss thresholds.
4. Produce an actionable gap list without changing source or tests.

## Atomic checklist
- [ ] Percentages are calculated consistently.
- [ ] Every threshold has a pass or miss result.
- [ ] Gaps include source locations where available.
- [ ] Metrics and gap array are recorded.

## Signal
Emit `GAPS_ANALYZED` with metrics and a gap array, or `ANALYSIS_FAILED` when required analysis data is absent.
