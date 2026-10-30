# ANALYZE

The runtime has validated the thresholds, run a clean baseline and written the coverage report to `{{context.coverage_report}}`.
Parse it, compare metrics with thresholds and identify gaps.

## Actions
1. Read the line, statement, branch, and function totals and covered counts from the report.
2. Calculate each metric percentage.
3. Compare each metric with its configured threshold.
4. List files, functions, or branches that miss thresholds.
5. Produce an actionable gap list without changing source or tests.

## Atomic checklist
- [ ] All four metric families are present.
- [ ] Percentages are calculated consistently.
- [ ] Every threshold has a pass or miss result.
- [ ] Gaps include source locations where available.
- [ ] Metrics and gap array are recorded.

## Signal
Emit `GAPS_ANALYZED` with metrics and a gap array, or `ANALYSIS_FAILED` when required analysis data is absent.
