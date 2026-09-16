# Runtime Execution

You MUST NOT manually bypass the reactive state machine.

If tools are missing (e.g. `allowed_tools: none` because the MCP server is not attached), you MUST abort the run immediately and ask the user to restart their agent harness or fix the connection.

Never "helpfully" guess the next states or manually scaffold the `.docs/` read models if the runtime is blocked.