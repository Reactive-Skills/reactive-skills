# Projections

Deliverables (`.docs/*.md`, `.json`) are rendered from Handlebars templates in `templates/*.hbs` via `ProjectionEngine`.

Never instruct the LLM to manually author summary files that the event stream already computes. The projection engine derives read models deterministically from the event log.