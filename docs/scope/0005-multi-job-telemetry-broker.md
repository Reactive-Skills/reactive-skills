# Multi-Job Telemetry Broker and Dashboard

## Intent

Provide one local, read-only telemetry broker and one site dashboard session that can monitor multiple jobs across multiple skills.

The existing single-job `view` command and its telemetry endpoints remain supported.

## Done When

The broker exposes catalog discovery, job-scoped state, and filtered multiplexed events for jobs stored in SQLite.

The site can track multiple skill and job pairs through one live SSE connection and keeps each card isolated to its target.

The required runtime, CLI, site, compatibility, and browser smoke tests pass, or any remaining failure is documented with evidence.

## Acceptance Seeds

1. A user can start the broker with loopback defaults or explicit host and port values and see the actual listener URL.

2. The catalog lists skills, jobs, active-job metadata, current state, latest per-job sequence, update time, and active status.

3. A valid skill and job pair returns only its own state, and invalid targets receive a clear client error.

4. One `/events` connection can deliver events from multiple skills and jobs with source identity and each job's local sequence.

5. Target filters restrict the stream to the selected skill and job pairs.

6. Events written by separate CLI, MCP, or worker processes become visible without restarting the broker.

7. A site user can add and remove tracked jobs, see the job ID on every card, and receive independent live updates.

8. The site displays explicit loading, empty, invalid-target, and connection-error states.

9. The existing single-job `view` command continues to support skill selection, explicit job selection, explicit port selection, and its current health, state, and event behavior.

10. The broker does not dispatch signals, change the active-job pointer, read arbitrary filesystem paths from HTTP parameters, or require an external message broker.

## Ordered Work

1. Map the existing telemetry, event-store, job-manager, CLI, site, and documentation contracts.

2. Decide the smallest compatible broker API, CLI command, catalog refresh strategy, and site connection model.

3. Implement broker discovery, scoped state, multiplexed event delivery, filtering, cross-process refresh, and compatibility behavior.

4. Implement the site multi-target dashboard while preserving the current single-job deck workflow.

5. Add focused runtime, CLI, site, compatibility, and cross-process tests.

6. Run the required build, test, site build, and browser smoke verification.

7. Review the diff, document usage and limitations, and synchronize durable project context.

## Workflow

This slice follows the Vertical slice delivery approach at the GA workflow tier.

Implementation, verification, review, and documentation are complete for this slice.
