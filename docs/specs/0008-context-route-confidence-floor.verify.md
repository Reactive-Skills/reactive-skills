# Manual Verification: Context Route Confidence Floor

These checks validate the context route behavior using the built workspace CLI and configured Jev access.

1. Run `pnpm run build` from the repository root.

2. Ensure the terminal has a valid `TYPESAFE_API_KEY` configured.

3. Run `pnpm --filter @reactive-skills/axi exec node dist/cli/index.js context-route --message "Use interface-craft to build a polished React marketing page" --candidates '[{"id":"interface-craft","skill":"interface-craft","summary":"Universal UI/UX and frontend engineering","keywords":["UI","frontend","design"]}]' --json`.

4. Confirm the JSON response selects `interface-craft`, returns a valid context mode, reports confidence of at least `0.40`, and provides a nonzero context budget.

5. In a terminal without `TYPESAFE_API_KEY`, rerun the same command.

6. Confirm the response is `route:none` with a zero context budget and Script fallback.

7. Run `pnpm test` and `pnpm test:axi` from the repository root to verify confidence boundaries and CLI behavior.
