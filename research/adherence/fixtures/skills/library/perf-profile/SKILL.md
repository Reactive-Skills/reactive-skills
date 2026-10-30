---
name: perf-profile
description: Profile a slow code path and write a performance report with measured timings.
---

# perf-profile

Use this when a report is about speed, latency or memory, not wrong results.

## Steps

1. Write a micro-benchmark for the reported path under `bench/`.
2. Run it five times and record the median.
3. Write `.work/perf-report.md` with the measurements and the hot spot.
