/** @type {import('@/contracts/types').RegistrySkillDetail[]} */
// Generated automatically by scripts/sync-registry.js from Reactive-Skills/skills
export const registrySkills = [
  {
    "slug": "jsm-workflow",
    "name": "Jsm Workflow",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "Metaprogramming & Lifecycle",
    "description": "Reactive SDLC coordinator taking software changes from intake to final context sync, implementing the JS Mastery Engineering Workflow (https://jsmastery.com/skills).",
    "tags": [
      "jsm-workflow",
      "jsm",
      "workflow"
    ],
    "strictExecution": true,
    "featured": true,
    "priorityBadge": "Flagship / SDLC",
    "featuredReason": "Reactive SDLC coordinator based on the JS Mastery Engineering Workflow (https://jsmastery.com/skills), orchestrating software changes from intake through architecture, test, verify, review, and context sync with event-bubbled decision reopening.",
    "initialState": "INIT",
    "contextKeys": [],
    "defaultContext": {},
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill jsm-workflow",
    "installCmd": "npx -y @reactive-skills/axi invoke jsm-workflow",
    "author": "Reactive Skills Core Team",
    "stateCount": 16,
    "states": [
      {
        "name": "INIT",
        "description": "Verify reactive runtime before any lifecycle work.",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "ACTIVE"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "ACTIVE",
        "description": "Owns every nonterminal SDLC phase and handles lifecycle-wide decision reopening.",
        "tools": [],
        "transitions": [
          {
            "signal": "DECISION_REOPENED",
            "target": "ACTIVE.ARCHITECT"
          }
        ]
      },
      {
        "name": "ACTIVE.INTAKE",
        "description": "Capture the work request, repo state, and completion target.",
        "tools": [],
        "transitions": [
          {
            "signal": "WORK_REQUEST_READY",
            "target": "ACTIVE.SCOPE"
          },
          {
            "signal": "BUG_FIX_REQUESTED",
            "target": "ACTIVE.DEBUG"
          },
          {
            "signal": "AUDIT_REQUESTED",
            "target": "ACTIVE.AUDIT"
          },
          {
            "signal": "DIRECT_BUILD_REQUESTED",
            "target": "ACTIVE.DEVELOP"
          },
          {
            "signal": "INTAKE_BLOCKED",
            "target": "COMPLETE"
          }
        ]
      },
      {
        "name": "ACTIVE.SCOPE",
        "description": "Convert the request into ordered work with acceptance seeds.",
        "tools": [],
        "transitions": [
          {
            "signal": "SCOPE_READY",
            "target": "ACTIVE.ARCHITECT"
          },
          {
            "signal": "SCOPE_ONLY",
            "target": "COMPLETE"
          },
          {
            "signal": "SCOPE_BLOCKED",
            "target": "COMPLETE"
          }
        ]
      },
      {
        "name": "ACTIVE.ARCHITECT",
        "description": "Settle load bearing design decisions before implementation.",
        "tools": [],
        "transitions": [
          {
            "signal": "SPEC_READY",
            "target": "ACTIVE.AUDIT"
          },
          {
            "signal": "DECISION_DEFERRED",
            "target": "COMPLETE"
          },
          {
            "signal": "DESIGN_FLAW_CONFIRMED",
            "target": "ACTIVE.SCOPE"
          }
        ]
      },
      {
        "name": "ACTIVE.AUDIT",
        "description": "Ensure durable project context exists and matches the work area.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTEXT_READY",
            "target": "ACTIVE.DEVELOP"
          },
          {
            "signal": "AUDIT_TO_SCOPE",
            "target": "ACTIVE.SCOPE"
          },
          {
            "signal": "CONTEXT_BLOCKED",
            "target": "COMPLETE"
          }
        ]
      },
      {
        "name": "ACTIVE.DEVELOP",
        "description": "Implement the scoped and designed change.",
        "tools": [],
        "transitions": [
          {
            "signal": "BUILD_READY",
            "target": "ACTIVE.VERIFY"
          },
          {
            "signal": "DECISION_NEEDED",
            "target": "ACTIVE.ARCHITECT"
          },
          {
            "signal": "BUILD_FAILED",
            "target": "ACTIVE.DEBUG"
          }
        ]
      },
      {
        "name": "ACTIVE.VERIFY",
        "description": "Prove behavior in the real product or service.",
        "tools": [],
        "transitions": [
          {
            "signal": "VERIFY_PASSED",
            "target": "ACTIVE.TEST"
          },
          {
            "signal": "VERIFY_FAILED",
            "target": "ACTIVE.DEBUG"
          },
          {
            "signal": "VERIFY_DEFERRED",
            "target": "ACTIVE.TEST"
          }
        ]
      },
      {
        "name": "ACTIVE.TEST",
        "description": "Write or update tests for durable behavior.",
        "tools": [],
        "transitions": [
          {
            "signal": "TEST_PASSED",
            "target": "ACTIVE.REVIEW"
          },
          {
            "signal": "TEST_FAILED",
            "target": "ACTIVE.DEBUG"
          },
          {
            "signal": "TEST_DEFERRED",
            "target": "ACTIVE.REVIEW"
          }
        ]
      },
      {
        "name": "ACTIVE.DEBUG",
        "description": "Reproduce failures, prove the root cause, apply the smallest fix, and verify it.",
        "tools": [],
        "transitions": [
          {
            "signal": "BUG_FIXED",
            "target": "ACTIVE.VERIFY"
          },
          {
            "signal": "DESIGN_FLAW",
            "target": "ACTIVE.ARCHITECT"
          },
          {
            "signal": "DEBUG_BLOCKED",
            "target": "COMPLETE"
          }
        ]
      },
      {
        "name": "ACTIVE.REVIEW",
        "description": "Review the diff for defects, risks, and missed requirements.",
        "tools": [],
        "transitions": [
          {
            "signal": "REVIEW_PASSED",
            "target": "ACTIVE.DOCUMENT"
          },
          {
            "signal": "REVIEW_FINDINGS",
            "target": "ACTIVE.DEVELOP"
          },
          {
            "signal": "REVIEW_DEFERRED",
            "target": "ACTIVE.DOCUMENT"
          }
        ]
      },
      {
        "name": "ACTIVE.DOCUMENT",
        "description": "Write human facing change prose from evidence.",
        "tools": [],
        "transitions": [
          {
            "signal": "DOCUMENTED",
            "target": "ACTIVE.SYNC"
          },
          {
            "signal": "DOCUMENT_DEFERRED",
            "target": "ACTIVE.SYNC"
          }
        ]
      },
      {
        "name": "ACTIVE.SYNC",
        "description": "Reconcile durable context, scope status, and decision status from repo evidence.",
        "tools": [],
        "transitions": [
          {
            "signal": "SYNCED",
            "target": "COMPLETE"
          },
          {
            "signal": "SYNC_BLOCKED",
            "target": "COMPLETE"
          }
        ]
      },
      {
        "name": "COMPLETE",
        "description": "Summarize outcome and next action.",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Runtime setup failed or execution became unsafe.",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Bypass detected because execution moved outside the signal contract.",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INIT\n    INIT --> ACTIVE : RUNTIME_READY\n    INIT --> ERROR : SETUP_REQUIRED\n\n    state ACTIVE {\n        [*] --> INTAKE\n        INTAKE --> SCOPE : WORK_REQUEST_READY\n        INTAKE --> DEBUG : BUG_FIX_REQUESTED\n        INTAKE --> AUDIT : AUDIT_REQUESTED\n        INTAKE --> DEVELOP : DIRECT_BUILD_REQUESTED\n        INTAKE --> COMPLETE : INTAKE_BLOCKED\n        SCOPE --> ARCHITECT : SCOPE_READY\n        SCOPE --> COMPLETE : SCOPE_ONLY\n        SCOPE --> COMPLETE : SCOPE_BLOCKED\n        ARCHITECT --> AUDIT : SPEC_READY\n        ARCHITECT --> COMPLETE : DECISION_DEFERRED\n        ARCHITECT --> SCOPE : DESIGN_FLAW_CONFIRMED\n        AUDIT --> DEVELOP : CONTEXT_READY\n        AUDIT --> SCOPE : AUDIT_TO_SCOPE\n        AUDIT --> COMPLETE : CONTEXT_BLOCKED\n        DEVELOP --> VERIFY : BUILD_READY\n        DEVELOP --> ARCHITECT : DECISION_NEEDED\n        DEVELOP --> DEBUG : BUILD_FAILED\n        VERIFY --> TEST : VERIFY_PASSED\n        VERIFY --> DEBUG : VERIFY_FAILED\n        VERIFY --> TEST : VERIFY_DEFERRED\n        TEST --> REVIEW : TEST_PASSED\n        TEST --> DEBUG : TEST_FAILED\n        TEST --> REVIEW : TEST_DEFERRED\n        DEBUG --> VERIFY : BUG_FIXED\n        DEBUG --> ARCHITECT : DESIGN_FLAW\n        DEBUG --> COMPLETE : DEBUG_BLOCKED\n        REVIEW --> DOCUMENT : REVIEW_PASSED\n        REVIEW --> DEVELOP : REVIEW_FINDINGS\n        REVIEW --> DOCUMENT : REVIEW_DEFERRED\n        DOCUMENT --> SYNC : DOCUMENTED\n        DOCUMENT --> SYNC : DOCUMENT_DEFERRED\n        SYNC --> COMPLETE : SYNCED\n        SYNC --> COMPLETE : SYNC_BLOCKED\n    }\n\n    ACTIVE --> ARCHITECT : DECISION_REOPENED (bubbled from child)\n    COMPLETE --> [*]\n    state BYPASS_DETECTED"
  },
  {
    "slug": "skill-manager",
    "name": "Skill Manager",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "Metaprogramming & Lifecycle",
    "description": "Full CRUD lifecycle management for reactive skills - CREATE UPDATE DELETE MIGRATE_LEGACY and MIGRATE_REACTIVE with pre-COMMIT approval best-effort rollback and manifest snapshot projection",
    "tags": [
      "skill-manager",
      "skill",
      "manager"
    ],
    "strictExecution": false,
    "featured": true,
    "priorityBadge": "Essential / Authoring",
    "featuredReason": "Core Utility: The official tool for creating, updating, and migrating reactive skills. Automatically synchronizes skill.yaml, state prompts, and STATECHART.md.",
    "initialState": "INIT",
    "contextKeys": [
      "skill_name",
      "operation",
      "skill_config",
      "migrate_mode",
      "source_version",
      "target_version"
    ],
    "defaultContext": {},
    "tools": [
      "run_command",
      "view_file",
      "find_by_name",
      "grep_search",
      "write_to_file",
      "replace_file_content",
      "list_dir"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill skill-manager",
    "installCmd": "npx -y @reactive-skills/axi invoke skill-manager",
    "author": "Reactive Skills Core Team",
    "stateCount": 22,
    "states": [
      {
        "name": "INIT",
        "description": "Bootloader: Verify reactive runtime environment",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "READY"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "SETUP_RUNTIME"
          }
        ]
      },
      {
        "name": "SETUP_RUNTIME",
        "description": "Auto-configure harness MCP server",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "SETUP_COMPLETE",
            "target": "READY",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "SETUP_FAILED",
            "target": "ERROR",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "READY",
        "description": "Operational state READY",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_INVOKED",
            "target": "PARSING",
            "guard": "context.skill_name != null"
          }
        ]
      },
      {
        "name": "PARSING",
        "description": "Operational state PARSING",
        "tools": [],
        "transitions": [
          {
            "signal": "PARSED",
            "target": "DETECTING",
            "guard": "[\"CREATE\",\"UPDATE\",\"DELETE\",\"MIGRATE_LEGACY\",\"MIGRATE_REACTIVE\"].includes(context.operation)"
          },
          {
            "signal": "ERROR",
            "target": "ERROR",
            "guard": "![\"CREATE\",\"UPDATE\",\"DELETE\",\"MIGRATE_LEGACY\",\"MIGRATE_REACTIVE\"].includes(context.operation)"
          }
        ]
      },
      {
        "name": "DETECTING",
        "description": "Operational state DETECTING",
        "tools": [
          "view_file",
          "find_by_name",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "NOT_EXISTS_CREATE",
            "target": "PLANNING",
            "guard": "context.operation === \"CREATE\""
          },
          {
            "signal": "EXISTS_CREATE",
            "target": "ERROR",
            "guard": "context.operation === \"CREATE\""
          },
          {
            "signal": "EXISTS_UPDATE_DELETE",
            "target": "PLANNING",
            "guard": "[\"UPDATE\",\"DELETE\"].includes(context.operation)"
          },
          {
            "signal": "NOT_EXISTS_UPDATE_DELETE",
            "target": "ERROR",
            "guard": "[\"UPDATE\",\"DELETE\"].includes(context.operation)"
          },
          {
            "signal": "IS_LEGACY",
            "target": "BACKING_UP_MIGRATE",
            "guard": "context.operation === \"MIGRATE_LEGACY\""
          },
          {
            "signal": "IS_NOT_LEGACY",
            "target": "ERROR",
            "guard": "context.operation === \"MIGRATE_LEGACY\""
          },
          {
            "signal": "IS_V1_REACTIVE",
            "target": "BACKING_UP_MIGRATE",
            "guard": "context.operation === \"MIGRATE_REACTIVE\""
          },
          {
            "signal": "NOT_V1_REACTIVE",
            "target": "ERROR",
            "guard": "context.operation === \"MIGRATE_REACTIVE\""
          }
        ]
      },
      {
        "name": "PLANNING",
        "description": "Operational state PLANNING",
        "tools": [],
        "transitions": [
          {
            "signal": "PLAN_READY",
            "target": "APPROVING"
          }
        ]
      },
      {
        "name": "APPROVING",
        "description": "Operational state APPROVING",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "EXECUTING"
          },
          {
            "signal": "USER_REJECTED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "EXECUTING",
        "description": "Operational state EXECUTING",
        "tools": [
          "view_file",
          "write_to_file",
          "replace_file_content",
          "run_command",
          "find_by_name",
          "grep_search",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "EXECUTED",
            "target": "VERIFYING"
          }
        ]
      },
      {
        "name": "VERIFYING",
        "description": "Operational state VERIFYING",
        "tools": [
          "view_file",
          "run_command",
          "find_by_name",
          "grep_search",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "VERIFIED_OK",
            "target": "PROJECTING",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "VERIFIED_FAIL",
            "target": "ROLLING_BACK",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "ROLLING_BACK",
        "description": "Operational state ROLLING_BACK",
        "tools": [
          "run_command",
          "view_file",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "ROLLED_BACK",
            "target": "ERROR"
          },
          {
            "signal": "ROLLBACK_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "BACKING_UP_MIGRATE",
        "description": "Operational state BACKING_UP_MIGRATE",
        "tools": [
          "run_command",
          "view_file",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "BACKED_UP_LEGACY",
            "target": "INFERRING_LEGACY",
            "guard": "context.operation === \"MIGRATE_LEGACY\""
          },
          {
            "signal": "BACKED_UP_REACTIVE",
            "target": "INSPECTING_REACTIVE",
            "guard": "context.operation === \"MIGRATE_REACTIVE\""
          }
        ]
      },
      {
        "name": "INFERRING_LEGACY",
        "description": "Operational state INFERRING_LEGACY",
        "tools": [],
        "transitions": [
          {
            "signal": "INFERRED",
            "target": "PLANNING_MIGRATE",
            "guard": "payload.confidence >= 0.5"
          },
          {
            "signal": "LOW_CONFIDENCE",
            "target": "GRILLING_MIGRATE",
            "guard": "payload.confidence < 0.5"
          }
        ]
      },
      {
        "name": "GRILLING_MIGRATE",
        "description": "Operational state GRILLING_MIGRATE",
        "tools": [],
        "transitions": [
          {
            "signal": "GRILL_COMPLETE",
            "target": "PLANNING_MIGRATE"
          }
        ]
      },
      {
        "name": "INSPECTING_REACTIVE",
        "description": "Operational state INSPECTING_REACTIVE",
        "tools": [],
        "transitions": [
          {
            "signal": "INSPECTED",
            "target": "PLANNING_MIGRATE"
          }
        ]
      },
      {
        "name": "PLANNING_MIGRATE",
        "description": "Operational state PLANNING_MIGRATE",
        "tools": [],
        "transitions": [
          {
            "signal": "PLAN_READY",
            "target": "APPROVING_MIGRATE"
          }
        ]
      },
      {
        "name": "APPROVING_MIGRATE",
        "description": "Operational state APPROVING_MIGRATE",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "EXECUTING_MIGRATE"
          },
          {
            "signal": "USER_REJECTED",
            "target": "RESTORING_MIGRATE"
          }
        ]
      },
      {
        "name": "EXECUTING_MIGRATE",
        "description": "Operational state EXECUTING_MIGRATE",
        "tools": [
          "view_file",
          "write_to_file",
          "replace_file_content",
          "run_command",
          "find_by_name",
          "grep_search",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "EXECUTED",
            "target": "VERIFYING_MIGRATE"
          }
        ]
      },
      {
        "name": "VERIFYING_MIGRATE",
        "description": "Operational state VERIFYING_MIGRATE",
        "tools": [
          "view_file",
          "run_command",
          "find_by_name",
          "grep_search",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "VERIFIED_OK",
            "target": "PROJECTING",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "VERIFIED_FAIL",
            "target": "RESTORING_MIGRATE",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "RESTORING_MIGRATE",
        "description": "Operational state RESTORING_MIGRATE",
        "tools": [
          "run_command",
          "view_file",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "RESTORED",
            "target": "ERROR"
          },
          {
            "signal": "RESTORE_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "PROJECTING",
        "description": "Operational state PROJECTING",
        "tools": [],
        "transitions": [
          {
            "signal": "PROJECTED",
            "target": "SUCCESS"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Operational state SUCCESS",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Operational state ERROR",
        "tools": [
          "write_to_file"
        ],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INIT\n\n    %% Bootloader & Runtime Verification\n    INIT --> READY : RUNTIME_READY\n    INIT --> SETUP_RUNTIME : SETUP_REQUIRED\n\n    SETUP_RUNTIME --> READY : SETUP_COMPLETE [exit_code == 0]\n    SETUP_RUNTIME --> ERROR : SETUP_FAILED [exit_code != 0]\n\n    READY --> PARSING : USER_INVOKED [skill_name != null]\n\n    PARSING --> DETECTING : PARSED [valid operation]\n    PARSING --> ERROR : ERROR [invalid operation]\n\n    %% Existence & Mode Detection\n    DETECTING --> PLANNING : NOT_EXISTS_CREATE [operation == CREATE]\n    DETECTING --> ERROR : EXISTS_CREATE [operation == CREATE]\n    DETECTING --> PLANNING : EXISTS_UPDATE_DELETE [operation in UPDATE, DELETE]\n    DETECTING --> ERROR : NOT_EXISTS_UPDATE_DELETE [operation in UPDATE, DELETE]\n    DETECTING --> BACKING_UP_MIGRATE : IS_LEGACY [operation == MIGRATE_LEGACY]\n    DETECTING --> ERROR : IS_NOT_LEGACY [operation == MIGRATE_LEGACY]\n    DETECTING --> BACKING_UP_MIGRATE : IS_V1_REACTIVE [operation == MIGRATE_REACTIVE]\n    DETECTING --> ERROR : NOT_V1_REACTIVE [operation == MIGRATE_REACTIVE]\n\n    %% CREATE / UPDATE / DELETE Lifecycle Branch\n    PLANNING --> APPROVING : PLAN_READY\n    APPROVING --> EXECUTING : USER_APPROVED\n    APPROVING --> ERROR : USER_REJECTED\n    EXECUTING --> VERIFYING : EXECUTED\n    VERIFYING --> PROJECTING : VERIFIED_OK [exit_code == 0]\n    VERIFYING --> ROLLING_BACK : VERIFIED_FAIL [exit_code != 0]\n    ROLLING_BACK --> ERROR : ROLLED_BACK\n    ROLLING_BACK --> ERROR : ROLLBACK_FAILED\n\n    %% Migration Branch (MIGRATE_LEGACY / MIGRATE_REACTIVE)\n    BACKING_UP_MIGRATE --> INFERRING_LEGACY : BACKED_UP_LEGACY [operation == MIGRATE_LEGACY]\n    BACKING_UP_MIGRATE --> INSPECTING_REACTIVE : BACKED_UP_REACTIVE [operation == MIGRATE_REACTIVE]\n\n    INFERRING_LEGACY --> PLANNING_MIGRATE : INFERRED [confidence >= 0.5]\n    INFERRING_LEGACY --> GRILLING_MIGRATE : LOW_CONFIDENCE [confidence < 0.5]\n    GRILLING_MIGRATE --> PLANNING_MIGRATE : GRILL_COMPLETE\n\n    INSPECTING_REACTIVE --> PLANNING_MIGRATE : INSPECTED\n\n    PLANNING_MIGRATE --> APPROVING_MIGRATE : PLAN_READY\n    APPROVING_MIGRATE --> EXECUTING_MIGRATE : USER_APPROVED\n    APPROVING_MIGRATE --> RESTORING_MIGRATE : USER_REJECTED\n    EXECUTING_MIGRATE --> VERIFYING_MIGRATE : EXECUTED\n    VERIFYING_MIGRATE --> PROJECTING : VERIFIED_OK [exit_code == 0]\n    VERIFYING_MIGRATE --> RESTORING_MIGRATE : VERIFIED_FAIL [exit_code != 0]\n    RESTORING_MIGRATE --> ERROR : RESTORED\n    RESTORING_MIGRATE --> ERROR : RESTORE_FAILED\n\n    %% Projection & Terminal States\n    PROJECTING --> SUCCESS : PROJECTED\n    SUCCESS --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/skill-manager/{{context.skill_name}}-snapshot.md",
      ".docs/skill-manager/inventory.json"
    ]
  },
  {
    "slug": "api-contract",
    "name": "Api Contract",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "General",
    "description": "OpenAPI/Swagger spec vs client code drift detector — parses spec, walks fetch/axios calls, detects mismatches",
    "tags": [
      "api-contract",
      "api",
      "contract"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "DISCOVER_APIS",
    "contextKeys": [
      "api_spec_path",
      "client_code_paths",
      "spec_schema",
      "client_endpoints",
      "drift_findings",
      "missing_endpoints",
      "type_mismatches",
      "deprecated_usage",
      "coverage_matrix"
    ],
    "defaultContext": {
      "api_spec_path": null,
      "client_code_paths": [],
      "spec_schema": null,
      "client_endpoints": [],
      "drift_findings": [],
      "missing_endpoints": [],
      "type_mismatches": [],
      "deprecated_usage": [],
      "coverage_matrix": {}
    },
    "tools": [
      "view_file",
      "grep_search",
      "find_by_name",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill api-contract",
    "installCmd": "npx -y @reactive-skills/axi invoke api-contract",
    "author": "Reactive Skills Core Team",
    "stateCount": 16,
    "states": [
      {
        "name": "DISCOVER_APIS",
        "description": "Discover OpenAPI/Swagger spec and identify client code paths",
        "tools": [
          "view_file",
          "grep_search",
          "find_by_name"
        ],
        "transitions": [
          {
            "signal": "SPEC_LOADED",
            "target": "VALIDATION_PIPELINE",
            "guard": "Boolean(event.payload.api_spec_path) && Boolean(event.payload.client_code_paths)"
          }
        ]
      },
      {
        "name": "VALIDATION_PIPELINE",
        "description": "Composite state: spec validation, client code walking, and drift diffing",
        "tools": [],
        "transitions": [
          {
            "signal": "SECURITY_CRITICAL_FOUND",
            "target": "BLOCKED",
            "guard": "event.payload.severity === 'critical'"
          }
        ]
      },
      {
        "name": "VALIDATION_PIPELINE.SCHEMA_VALIDATION",
        "description": "Composite state: parse and validate OpenAPI spec schema",
        "tools": [],
        "transitions": []
      },
      {
        "name": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.OPENAPI_CHECK",
        "description": "Validate spec is well-formed OpenAPI/Swagger",
        "tools": [
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "OPENAPI_CHECK_DONE",
            "target": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.TYPE_COMPATIBILITY",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.TYPE_COMPATIBILITY",
        "description": "Verify spec schema types and definitions are consistent",
        "tools": [
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "TYPE_CHECK_DONE",
            "target": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.BREAKING_CHANGE_DETECTION",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.BREAKING_CHANGE_DETECTION",
        "description": "Scan for deprecated endpoints and breaking change patterns",
        "tools": [
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "BREAKING_CHECK_DONE",
            "target": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.EXAMPLE_CONFORMANCE",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "VALIDATION_PIPELINE.SCHEMA_VALIDATION.EXAMPLE_CONFORMANCE",
        "description": "Validate spec examples match schema definitions",
        "tools": [
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "EXAMPLE_CHECK_DONE",
            "target": "VALIDATION_PIPELINE.DRIFT_DIFFING",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "VALIDATION_PIPELINE.DRIFT_DIFFING",
        "description": "Walk client code and diff against spec for mismatches",
        "tools": [
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "DRIFT_DIFFED",
            "target": "DRIFT_ANALYSIS",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "DRIFT_ANALYSIS",
        "description": "Analyze drift findings and classify by severity",
        "tools": [
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "DRIFT_CLASSIFIED",
            "target": "REPORT"
          },
          {
            "signal": "CRITICAL_DRIFT",
            "target": "BLOCKED",
            "guard": "event.payload.severity === 'critical'"
          }
        ]
      },
      {
        "name": "REPORT",
        "description": "Composite state: generate drift report and fix recommendations",
        "tools": [],
        "transitions": [
          {
            "signal": "REPORT_ERROR",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "REPORT.VIOLATION_SUMMARY",
        "description": "Summarize all drift violations by category",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "SUMMARY_GENERATED",
            "target": "REPORT.FIX_RECOMMENDATIONS"
          }
        ]
      },
      {
        "name": "REPORT.FIX_RECOMMENDATIONS",
        "description": "Generate actionable fix recommendations for each violation",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "RECOMMENDATIONS_GENERATED",
            "target": "GATE"
          }
        ]
      },
      {
        "name": "GATE",
        "description": "Human review gate: approve, request revisions, or reject",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "COMPLETED",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "USER_REQUEST_REVISIONS",
            "target": "DRIFT_ANALYSIS",
            "guard": "event.payload.revisions_requested === true"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED",
            "guard": "event.payload.rejected === true"
          }
        ]
      },
      {
        "name": "COMPLETED",
        "description": "Terminal state: API contract validation complete",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Terminal state: Critical issues found, workflow halted",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal state: Unrecoverable error occurred",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> DISCOVER_APIS\n    DISCOVER_APIS --> VALIDATION_PIPELINE: SPEC_LOADED [spec and code paths valid]\n\n    state VALIDATION_PIPELINE {\n        [*] --> SCHEMA_VALIDATION\n\n        state SCHEMA_VALIDATION {\n            [*] --> OPENAPI_CHECK\n            OPENAPI_CHECK --> TYPE_COMPATIBILITY: OPENAPI_CHECK_DONE [exit_code == 0]\n            TYPE_COMPATIBILITY --> BREAKING_CHANGE_DETECTION: TYPE_CHECK_DONE [exit_code == 0]\n            BREAKING_CHANGE_DETECTION --> EXAMPLE_CONFORMANCE: BREAKING_CHECK_DONE [exit_code == 0]\n        }\n\n        SCHEMA_VALIDATION --> DRIFT_DIFFING: EXAMPLE_CHECK_DONE [exit_code == 0]\n    }\n\n    %% External transitions from VALIDATION_PIPELINE\n    VALIDATION_PIPELINE --> BLOCKED: SECURITY_CRITICAL_FOUND [severity == critical]\n    DRIFT_DIFFING --> DRIFT_ANALYSIS: DRIFT_DIFFED [exit_code == 0]\n\n    DRIFT_ANALYSIS --> REPORT: DRIFT_CLASSIFIED\n    DRIFT_ANALYSIS --> BLOCKED: CRITICAL_DRIFT [severity == critical]\n\n    state REPORT {\n        [*] --> VIOLATION_SUMMARY\n        VIOLATION_SUMMARY --> FIX_RECOMMENDATIONS: SUMMARY_GENERATED\n    }\n\n    %% External transitions from REPORT\n    REPORT --> ERROR: REPORT_ERROR\n    FIX_RECOMMENDATIONS --> GATE: RECOMMENDATIONS_GENERATED\n\n    GATE --> COMPLETED: USER_APPROVED [approved == true]\n    GATE --> DRIFT_ANALYSIS: USER_REQUEST_REVISIONS [revisions_requested == true]\n    GATE --> BLOCKED: USER_REJECTED [rejected == true]\n\n    COMPLETED --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/api-contract/drift.md",
      ".docs/api-contract/coverage.md",
      ".docs/api-contract/state.json"
    ]
  },
  {
    "slug": "browser-verifier",
    "name": "Browser Verifier",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "General",
    "description": "Automated browser verification reactive skill that launches headless browser sessions, verifies DOM states, intercepts console errors, and captures visual artifacts.",
    "tags": [
      "browser-verifier",
      "browser",
      "verifier"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "target_url",
      "test_suite",
      "browser_type",
      "assertion_rules",
      "console_errors",
      "network_failures",
      "screenshot_path",
      "gate_decision",
      "deliverable_path"
    ],
    "defaultContext": {
      "target_url": "http://localhost:3000",
      "test_suite": null,
      "browser_type": "chromium",
      "assertion_rules": [],
      "console_errors": [],
      "network_failures": [],
      "screenshot_path": null,
      "gate_decision": null,
      "deliverable_path": ".docs/browser-verifier/"
    },
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill browser-verifier",
    "installCmd": "npx -y @reactive-skills/axi invoke browser-verifier",
    "author": "Reactive Skills Core Team",
    "stateCount": 10,
    "states": [
      {
        "name": "INTAKE",
        "description": "Collect target application URL, browser configuration, and DOM assertion rules",
        "tools": [],
        "transitions": [
          {
            "signal": "CONFIGURE",
            "target": "BOOT",
            "guard": "Boolean(context.target_url)"
          },
          {
            "signal": "ABORT",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "BOOT",
        "description": "Initialize headless browser instance and configure diagnostic listeners",
        "tools": [],
        "transitions": [
          {
            "signal": "READY",
            "target": "NAVIGATE"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "NAVIGATE",
        "description": "Navigate to target URL, verify HTTP response code, and await network idle",
        "tools": [],
        "transitions": [
          {
            "signal": "LOADED",
            "target": "ASSERT_DOM"
          },
          {
            "signal": "NETWORK_FAIL",
            "target": "BLOCKED"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "ASSERT_DOM",
        "description": "Execute structural DOM assertions, visibility checks, and interactive element verification",
        "tools": [],
        "transitions": [
          {
            "signal": "VERIFIED",
            "target": "INSPECT_CONSOLE"
          },
          {
            "signal": "ASSERTION_FAIL",
            "target": "BLOCKED"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "INSPECT_CONSOLE",
        "description": "Inspect browser execution logs for unhandled errors, warnings, and failed network calls",
        "tools": [],
        "transitions": [
          {
            "signal": "CLEAN",
            "target": "CAPTURE_ARTIFACT"
          },
          {
            "signal": "ERRORS_FOUND",
            "target": "BLOCKED"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "CAPTURE_ARTIFACT",
        "description": "Capture visual screenshot and DOM state snapshot into documentation deliverables",
        "tools": [],
        "transitions": [
          {
            "signal": "CAPTURED",
            "target": "GATE"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "GATE",
        "description": "Evaluate complete browser verification results and issue release pass or block decision",
        "tools": [],
        "transitions": [
          {
            "signal": "APPROVE",
            "target": "SUCCESS",
            "guard": "context.console_errors.length === 0"
          },
          {
            "signal": "REJECT",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Browser verification passed cleanly with zero errors and all assertions verified",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Verification blocked due to failed assertions, console exceptions, or network errors",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Fatal error during browser lifecycle or unrecoverable test runner fault",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> BOOT: CONFIGURE\n    INTAKE --> ERROR: ABORT\n\n    BOOT --> NAVIGATE: READY\n    BOOT --> ERROR: FAIL\n\n    NAVIGATE --> ASSERT_DOM: LOADED\n    NAVIGATE --> BLOCKED: NETWORK_FAIL\n    NAVIGATE --> ERROR: FAIL\n\n    ASSERT_DOM --> INSPECT_CONSOLE: VERIFIED\n    ASSERT_DOM --> BLOCKED: ASSERTION_FAIL\n    ASSERT_DOM --> ERROR: FAIL\n\n    INSPECT_CONSOLE --> CAPTURE_ARTIFACT: CLEAN\n    INSPECT_CONSOLE --> BLOCKED: ERRORS_FOUND\n    INSPECT_CONSOLE --> ERROR: FAIL\n\n    CAPTURE_ARTIFACT --> GATE: CAPTURED\n    CAPTURE_ARTIFACT --> ERROR: FAIL\n\n    GATE --> SUCCESS: APPROVE\n    GATE --> BLOCKED: REJECT\n\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]"
  },
  {
    "slug": "ci-cd-automation",
    "name": "Ci Cd Automation",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "General",
    "description": "Automated CI/CD pipeline generator and linter that scaffolds production-ready workflows with caching, matrix builds, and security gates.",
    "tags": [
      "ci-cd-automation",
      "ci",
      "cd",
      "automation"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "provider",
      "ecosystem",
      "test_command",
      "build_command",
      "workflow_path",
      "lint_errors",
      "security_findings",
      "gate_decision",
      "deliverable_path"
    ],
    "defaultContext": {
      "provider": "github-actions",
      "ecosystem": null,
      "test_command": null,
      "build_command": null,
      "workflow_path": null,
      "lint_errors": [],
      "security_findings": [],
      "gate_decision": null,
      "deliverable_path": ".docs/ci-cd-automation/"
    },
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill ci-cd-automation",
    "installCmd": "npx -y @reactive-skills/axi invoke ci-cd-automation",
    "author": "Reactive Skills Core Team",
    "stateCount": 9,
    "states": [
      {
        "name": "INTAKE",
        "description": "Collect target CI provider, project build commands, and testing requirements",
        "tools": [],
        "transitions": [
          {
            "signal": "CONFIGURE",
            "target": "DETECT_STACK",
            "guard": "Boolean(context.provider)"
          },
          {
            "signal": "ABORT",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "DETECT_STACK",
        "description": "Detect repository language, package manager, and caching strategy",
        "tools": [],
        "transitions": [
          {
            "signal": "DETECTED",
            "target": "GENERATE_PIPELINE"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "GENERATE_PIPELINE",
        "description": "Scaffold workflow configuration with matrix testing, caching, and least-privilege permissions",
        "tools": [],
        "transitions": [
          {
            "signal": "GENERATED",
            "target": "LINT_WORKFLOW"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "LINT_WORKFLOW",
        "description": "Verify workflow YAML syntax, step references, and action version integrity",
        "tools": [],
        "transitions": [
          {
            "signal": "VALID",
            "target": "SECURITY_AUDIT"
          },
          {
            "signal": "SYNTAX_ERROR",
            "target": "BLOCKED"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "SECURITY_AUDIT",
        "description": "Audit pipeline for permission boundaries, secret exfiltration risks, and action pinning",
        "tools": [],
        "transitions": [
          {
            "signal": "SECURE",
            "target": "GATE"
          },
          {
            "signal": "VULNERABILITY_FOUND",
            "target": "BLOCKED"
          },
          {
            "signal": "FAIL",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "GATE",
        "description": "Evaluate workflow compliance and issue final approval for deployment",
        "tools": [],
        "transitions": [
          {
            "signal": "APPROVE",
            "target": "SUCCESS",
            "guard": "context.security_findings.length === 0"
          },
          {
            "signal": "REJECT",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "CI/CD pipeline generated, verified, and hardened successfully",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Pipeline blocked due to security violations, invalid syntax, or failed quality checks",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Fatal error during stack detection or workflow generation",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> DETECT_STACK: CONFIGURE\n    INTAKE --> ERROR: ABORT\n\n    DETECT_STACK --> GENERATE_PIPELINE: DETECTED\n    DETECT_STACK --> ERROR: FAIL\n\n    GENERATE_PIPELINE --> LINT_WORKFLOW: GENERATED\n    GENERATE_PIPELINE --> ERROR: FAIL\n\n    LINT_WORKFLOW --> SECURITY_AUDIT: VALID\n    LINT_WORKFLOW --> BLOCKED: SYNTAX_ERROR\n    LINT_WORKFLOW --> ERROR: FAIL\n\n    SECURITY_AUDIT --> GATE: SECURE\n    SECURITY_AUDIT --> BLOCKED: VULNERABILITY_FOUND\n    SECURITY_AUDIT --> ERROR: FAIL\n\n    GATE --> SUCCESS: APPROVE\n    GATE --> BLOCKED: REJECT\n\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]"
  },
  {
    "slug": "docs-architect",
    "name": "Docs Architect",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "Metaprogramming & Lifecycle",
    "description": "Documentation architecture workflow that discovers source truth, designs information architecture, authors living documentation, embeds diagrams, validates links, and gates publication.",
    "tags": [
      "docs-architect",
      "docs",
      "architect"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "source_paths",
      "audience",
      "outcomes",
      "documentation_scope",
      "extracted_facts",
      "architecture_decision",
      "documentation_outline",
      "diagram_inventory",
      "draft_path",
      "validation_exit_code",
      "review_decision",
      "deliverable_path"
    ],
    "defaultContext": {
      "source_paths": [],
      "audience": null,
      "outcomes": [],
      "documentation_scope": null,
      "extracted_facts": [],
      "architecture_decision": null,
      "documentation_outline": null,
      "diagram_inventory": [],
      "draft_path": null,
      "validation_exit_code": null,
      "review_decision": null,
      "deliverable_path": null
    },
    "tools": [
      "view_file",
      "find_by_name",
      "grep_search",
      "run_command",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill docs-architect",
    "installCmd": "npx -y @reactive-skills/axi invoke docs-architect",
    "author": "Reactive Skills Core Team",
    "stateCount": 11,
    "states": [
      {
        "name": "INTAKE",
        "description": "Collect source paths, audience, outcomes, and documentation scope",
        "tools": [
          "view_file",
          "find_by_name",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "INTAKE_READY",
            "target": "DISCOVER",
            "guard": "Array.isArray(event.payload.source_paths) && event.payload.source_paths.length > 0 && event.payload.audience != null && Array.isArray(event.payload.outcomes)"
          },
          {
            "signal": "INTAKE_INVALID",
            "target": "ERROR",
            "guard": "!(Array.isArray(event.payload.source_paths) && event.payload.source_paths.length > 0 && event.payload.audience != null && Array.isArray(event.payload.outcomes))"
          }
        ]
      },
      {
        "name": "DISCOVER",
        "description": "Inventory source files and identify authoritative documentation inputs",
        "tools": [
          "find_by_name",
          "grep_search",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "DISCOVERY_COMPLETE",
            "target": "EXTRACT",
            "guard": "event.payload.exit_code === 0"
          },
          {
            "signal": "DISCOVERY_FAILED",
            "target": "ERROR",
            "guard": "event.payload.exit_code !== 0"
          }
        ]
      },
      {
        "name": "EXTRACT",
        "description": "Extract facts, APIs, decisions, interfaces, and operational constraints",
        "tools": [
          "view_file",
          "grep_search",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "FACTS_EXTRACTED",
            "target": "DESIGN",
            "guard": "Array.isArray(event.payload.extracted_facts) && event.payload.extracted_facts.length > 0"
          },
          {
            "signal": "EXTRACTION_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.extracted_facts) || event.payload.extracted_facts.length === 0"
          }
        ]
      },
      {
        "name": "DESIGN",
        "description": "Choose information architecture and map content to audience outcomes",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "ARCHITECTURE_DESIGNED",
            "target": "AUTHOR",
            "guard": "event.payload.architecture_decision != null && Array.isArray(event.payload.documentation_outline) && event.payload.documentation_outline.length > 0"
          },
          {
            "signal": "DESIGN_FAILED",
            "target": "ERROR",
            "guard": "event.payload.architecture_decision == null || !Array.isArray(event.payload.documentation_outline) || event.payload.documentation_outline.length === 0"
          }
        ]
      },
      {
        "name": "AUTHOR",
        "description": "Draft concise, source-linked documentation from the approved outline",
        "tools": [
          "view_file",
          "write_to_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "DRAFT_WRITTEN",
            "target": "DIAGRAM",
            "guard": "event.payload.draft_path != null && event.payload.draft_path.length > 0"
          },
          {
            "signal": "AUTHORING_FAILED",
            "target": "ERROR",
            "guard": "event.payload.draft_path == null || event.payload.draft_path.length === 0"
          }
        ]
      },
      {
        "name": "DIAGRAM",
        "description": "Create embedded diagrams from documented relationships and decisions",
        "tools": [
          "view_file",
          "write_to_file",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "DIAGRAMS_EMBEDDED",
            "target": "VALIDATE",
            "guard": "Array.isArray(event.payload.diagram_inventory) && event.payload.diagram_inventory.length > 0"
          },
          {
            "signal": "DIAGRAM_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.diagram_inventory) || event.payload.diagram_inventory.length === 0"
          }
        ]
      },
      {
        "name": "VALIDATE",
        "description": "Check links, terminology, source traceability, diagram integrity, and readability",
        "tools": [
          "run_command",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "VALIDATION_PASSED",
            "target": "REVIEW",
            "guard": "event.payload.validation_exit_code === 0"
          },
          {
            "signal": "VALIDATION_FAILED",
            "target": "ERROR",
            "guard": "event.payload.validation_exit_code !== 0"
          }
        ]
      },
      {
        "name": "REVIEW",
        "description": "Human review gate for accuracy, usefulness, and publication readiness",
        "tools": [
          "view_file"
        ],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "SUCCESS",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "USER_REQUEST_REVISIONS",
            "target": "AUTHOR",
            "guard": "event.payload.revisions_requested === true"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED",
            "guard": "event.payload.rejected === true"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Terminal state: validated documentation architecture is published",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Terminal state: publication rejected or blocked by review",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal state: documentation workflow failed",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> DISCOVER: INTAKE_READY (valid intake)\n    INTAKE --> ERROR: INTAKE_INVALID (invalid intake)\n    DISCOVER --> EXTRACT: DISCOVERY_COMPLETE (exit_code == 0)\n    DISCOVER --> ERROR: DISCOVERY_FAILED (exit_code != 0)\n    EXTRACT --> DESIGN: FACTS_EXTRACTED (facts present)\n    EXTRACT --> ERROR: EXTRACTION_FAILED (no facts)\n    DESIGN --> AUTHOR: ARCHITECTURE_DESIGNED (decision and outline present)\n    DESIGN --> ERROR: DESIGN_FAILED (decision or outline missing)\n    AUTHOR --> DIAGRAM: DRAFT_WRITTEN (draft path present)\n    AUTHOR --> ERROR: AUTHORING_FAILED (draft path missing)\n    DIAGRAM --> VALIDATE: DIAGRAMS_EMBEDDED (diagram inventory present)\n    DIAGRAM --> ERROR: DIAGRAM_FAILED (diagram inventory empty)\n    VALIDATE --> REVIEW: VALIDATION_PASSED (exit_code == 0)\n    VALIDATE --> ERROR: VALIDATION_FAILED (exit_code != 0)\n    REVIEW --> SUCCESS: USER_APPROVED (approved == true)\n    REVIEW --> AUTHOR: USER_REQUEST_REVISIONS (revisions_requested == true)\n    REVIEW --> BLOCKED: USER_REJECTED (rejected == true)\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/docs-architect/documentation-architecture.md",
      ".docs/docs-architect/diagram-inventory.md",
      ".docs/docs-architect/state.json"
    ]
  },
  {
    "slug": "mutation-tester",
    "name": "Mutation Tester",
    "version": "1.0.0",
    "schemaVersion": "2.2.0",
    "category": "Testing & Quality",
    "description": "Technology-agnostic mutation testing reactive skill powered by high-performance Go CLI engine.",
    "tags": [
      "mutation-tester",
      "mutation",
      "tester"
    ],
    "strictExecution": true,
    "featured": false,
    "initialState": "READY",
    "contextKeys": [
      "target_dir",
      "runner_cmd",
      "diff_ref",
      "timeout_sec",
      "baseline_passed",
      "total_mutants",
      "killed_mutants",
      "survived_mutants",
      "timed_out_mutants",
      "compile_error_mutants",
      "mutation_score",
      "report_path",
      "exit_code"
    ],
    "defaultContext": {
      "target_dir": ".",
      "runner_cmd": null,
      "diff_ref": null,
      "timeout_sec": 5,
      "baseline_passed": false,
      "total_mutants": 0,
      "killed_mutants": 0,
      "survived_mutants": 0,
      "timed_out_mutants": 0,
      "compile_error_mutants": 0,
      "mutation_score": 0,
      "report_path": ".docs/mutation-scorecard.md",
      "exit_code": 0
    },
    "tools": [
      "view_file",
      "run_command",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill mutation-tester",
    "installCmd": "npx -y @reactive-skills/axi invoke mutation-tester",
    "author": "Reactive Skills Core Team",
    "stateCount": 9,
    "states": [
      {
        "name": "READY",
        "description": "Initial intake state, await execution parameters",
        "tools": [
          "view_file",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "START",
            "target": "INSPECTING"
          }
        ]
      },
      {
        "name": "INSPECTING",
        "description": "Auto-detect workspace runner and resolve git-diff line scoping",
        "tools": [
          "run_command",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "CONFIGURED",
            "target": "BASELINING"
          },
          {
            "signal": "INSPECTION_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "BASELINING",
        "description": "Run test suite against unmutated code to ensure 100% clean baseline",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "BASELINE_PASSED",
            "target": "MUTATING",
            "guard": "payload.exit_code === 0"
          },
          {
            "signal": "BASELINE_FAILED",
            "target": "ERROR",
            "guard": "payload.exit_code !== 0"
          }
        ]
      },
      {
        "name": "MUTATING",
        "description": "Synthesize AST/token mutants and apply differential filters",
        "tools": [
          "run_command",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "MUTANTS_GENERATED",
            "target": "EXECUTING"
          },
          {
            "signal": "MUTATION_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "EXECUTING",
        "description": "Execute test suite across mutants with in-place swap and atomic rollback",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "EXECUTION_COMPLETED",
            "target": "PROJECTING"
          },
          {
            "signal": "EXECUTION_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "PROJECTING",
        "description": "Calculate mutation scorecard metrics and generate deliverable projections",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "PROJECTIONS_WRITTEN",
            "target": "REPORTING"
          }
        ]
      },
      {
        "name": "REPORTING",
        "description": "Present scorecard and surviving mutants review gate to human",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_ACCEPTED",
            "target": "SUCCESS"
          },
          {
            "signal": "USER_REMEDIATE",
            "target": "BASELINING"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Mutation testing complete with certified scorecard",
        "tools": [],
        "transitions": [
          {
            "signal": "RESET",
            "target": "READY"
          }
        ]
      },
      {
        "name": "ERROR",
        "description": "Mutation testing run aborted or failed",
        "tools": [],
        "transitions": [
          {
            "signal": "RETRY",
            "target": "READY"
          }
        ]
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> READY\n\n    READY --> INSPECTING: START\n    INSPECTING --> BASELINING: CONFIGURED\n    INSPECTING --> ERROR: INSPECTION_FAILED\n\n    BASELINING --> MUTATING: BASELINE_PASSED (exit_code == 0)\n    BASELINING --> ERROR: BASELINE_FAILED (exit_code != 0)\n\n    MUTATING --> EXECUTING: MUTANTS_GENERATED\n    MUTATING --> ERROR: MUTATION_FAILED\n\n    EXECUTING --> PROJECTING: EXECUTION_COMPLETED\n    EXECUTING --> ERROR: EXECUTION_FAILED\n\n    PROJECTING --> REPORTING: PROJECTIONS_WRITTEN\n\n    REPORTING --> SUCCESS: USER_ACCEPTED\n    REPORTING --> BASELINING: USER_REMEDIATE\n\n    SUCCESS --> READY: RESET\n    ERROR --> READY: RETRY",
    "deliverables": [
      ".docs/mutation-scorecard.md",
      ".docs/mutation-report.json"
    ]
  },
  {
    "slug": "onboarding-map",
    "name": "Onboarding Map",
    "version": "1.0.0",
    "schemaVersion": "reactive/v2.0.0",
    "category": "General",
    "description": "Codebase onboarding workflow: intake role and scope, scan architecture and ownership, map modules and dependencies, design a personalized learning path, review with stakeholders, and approve completion.",
    "tags": [
      "onboarding-map",
      "onboarding",
      "map"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "repo_path",
      "user_role",
      "module_count",
      "dependency_graph",
      "learning_path",
      "stakeholder_feedback"
    ],
    "defaultContext": {},
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill onboarding-map",
    "installCmd": "npx -y @reactive-skills/axi invoke onboarding-map",
    "author": "Reactive Skills Core Team",
    "stateCount": 8,
    "states": [
      {
        "name": "INTAKE",
        "description": "Operational state INTAKE",
        "tools": [],
        "transitions": [
          {
            "signal": "INGESTED",
            "target": "SCAN",
            "guard": "context.repo_path != null && context.user_role != null"
          }
        ]
      },
      {
        "name": "SCAN",
        "description": "Operational state SCAN",
        "tools": [],
        "transitions": [
          {
            "signal": "SCANNED",
            "target": "MAP",
            "guard": "context.module_count > 0"
          },
          {
            "signal": "SCAN_FAILED",
            "target": "ERROR",
            "guard": "context.module_count == 0"
          }
        ]
      },
      {
        "name": "MAP",
        "description": "Operational state MAP",
        "tools": [],
        "transitions": [
          {
            "signal": "MAPPED",
            "target": "PATH",
            "guard": "context.dependency_graph != null"
          },
          {
            "signal": "MAP_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "PATH",
        "description": "Operational state PATH",
        "tools": [],
        "transitions": [
          {
            "signal": "DESIGNED",
            "target": "REVIEW",
            "guard": "context.learning_path != null"
          },
          {
            "signal": "PATH_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "REVIEW",
        "description": "Operational state REVIEW",
        "tools": [],
        "transitions": [
          {
            "signal": "APPROVED",
            "target": "SUCCESS"
          },
          {
            "signal": "REJECTED",
            "target": "PATH"
          },
          {
            "signal": "BLOCKED",
            "target": "BLOCKED"
          },
          {
            "signal": "REVIEW_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Operational state SUCCESS",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Operational state BLOCKED",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Operational state ERROR",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> SCAN: INGESTED\n    SCAN --> MAP: SCANNED\n    MAP --> PATH: MAPPED\n    PATH --> REVIEW: DESIGNED\n    REVIEW --> SUCCESS: APPROVED\n    REVIEW --> PATH: REJECTED\n    REVIEW --> BLOCKED: BLOCKED\n    SCAN --> ERROR: SCAN_FAILED\n    MAP --> ERROR: MAP_FAILED\n    PATH --> ERROR: PATH_FAILED\n    REVIEW --> ERROR: REVIEW_FAILED\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]"
  },
  {
    "slug": "pr-triage",
    "name": "Pr Triage",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "Testing & Quality",
    "description": "Pull request triage workflow that collects PR metadata, classifies risk and ownership, assesses readiness, routes work, and pauses at a human disposition gate.",
    "tags": [
      "pr-triage",
      "pr",
      "triage"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "repository",
      "pull_requests",
      "triage_policy",
      "collected_items",
      "classifications",
      "assessments",
      "routing_plan",
      "review_decision",
      "deliverable_path"
    ],
    "defaultContext": {
      "repository": null,
      "pull_requests": [],
      "triage_policy": null,
      "collected_items": [],
      "classifications": [],
      "assessments": [],
      "routing_plan": [],
      "review_decision": null,
      "deliverable_path": null
    },
    "tools": [
      "view_file",
      "run_command",
      "grep_search",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill pr-triage",
    "installCmd": "npx -y @reactive-skills/axi invoke pr-triage",
    "author": "Reactive Skills Core Team",
    "stateCount": 9,
    "states": [
      {
        "name": "INTAKE",
        "description": "Collect repository, pull request batch, and triage policy",
        "tools": [
          "view_file",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "INTAKE_READY",
            "target": "COLLECT",
            "guard": "event.payload.repository != null && Array.isArray(event.payload.pull_requests) && event.payload.pull_requests.length > 0 && event.payload.triage_policy != null"
          },
          {
            "signal": "INTAKE_INVALID",
            "target": "ERROR",
            "guard": "event.payload.repository == null || !Array.isArray(event.payload.pull_requests) || event.payload.pull_requests.length === 0 || event.payload.triage_policy == null"
          }
        ]
      },
      {
        "name": "COLLECT",
        "description": "Collect PR metadata, checks, reviews, diffs, and ownership signals",
        "tools": [
          "run_command",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "COLLECTION_COMPLETE",
            "target": "CLASSIFY",
            "guard": "Array.isArray(event.payload.collected_items) && event.payload.collected_items.length > 0"
          },
          {
            "signal": "COLLECTION_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.collected_items) || event.payload.collected_items.length === 0"
          }
        ]
      },
      {
        "name": "CLASSIFY",
        "description": "Classify each PR by risk, size, ownership, and required reviewer",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "CLASSIFICATION_COMPLETE",
            "target": "ASSESS",
            "guard": "Array.isArray(event.payload.classifications) && event.payload.classifications.length > 0"
          },
          {
            "signal": "CLASSIFICATION_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.classifications) || event.payload.classifications.length === 0"
          }
        ]
      },
      {
        "name": "ASSESS",
        "description": "Assess readiness, risk signals, test status, and policy compliance",
        "tools": [
          "view_file",
          "grep_search",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "ASSESSMENT_COMPLETE",
            "target": "ROUTE",
            "guard": "Array.isArray(event.payload.assessments) && event.payload.assessments.length > 0"
          },
          {
            "signal": "ASSESSMENT_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.assessments) || event.payload.assessments.length === 0"
          }
        ]
      },
      {
        "name": "ROUTE",
        "description": "Build deterministic routing and disposition recommendations",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "ROUTING_COMPLETE",
            "target": "REVIEW",
            "guard": "Array.isArray(event.payload.routing_plan) && event.payload.routing_plan.length > 0"
          },
          {
            "signal": "ROUTING_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.routing_plan) || event.payload.routing_plan.length === 0"
          }
        ]
      },
      {
        "name": "REVIEW",
        "description": "Human gate to approve, rework, or block the triage result",
        "tools": [
          "view_file"
        ],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "SUCCESS",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "USER_REQUEST_REWORK",
            "target": "ASSESS",
            "guard": "event.payload.rework_requested === true"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED",
            "guard": "event.payload.rejected === true"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Terminal state: PR triage approved",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Terminal state: PR triage blocked",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal state: PR triage workflow failed",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> COLLECT: INTAKE_READY (valid intake)\n    INTAKE --> ERROR: INTAKE_INVALID (invalid intake)\n    COLLECT --> CLASSIFY: COLLECTION_COMPLETE (items present)\n    COLLECT --> ERROR: COLLECTION_FAILED (no items)\n    CLASSIFY --> ASSESS: CLASSIFICATION_COMPLETE (classifications present)\n    CLASSIFY --> ERROR: CLASSIFICATION_FAILED (no classifications)\n    ASSESS --> ROUTE: ASSESSMENT_COMPLETE (assessments present)\n    ASSESS --> ERROR: ASSESSMENT_FAILED (no assessments)\n    ROUTE --> REVIEW: ROUTING_COMPLETE (routing plan present)\n    ROUTE --> ERROR: ROUTING_FAILED (no routing plan)\n    REVIEW --> SUCCESS: USER_APPROVED (approved == true)\n    REVIEW --> ASSESS: USER_REQUEST_REWORK (rework_requested == true)\n    REVIEW --> BLOCKED: USER_REJECTED (rejected == true)\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/pr-triage/triage-report.md",
      ".docs/pr-triage/state.json"
    ]
  },
  {
    "slug": "product-manager",
    "name": "Product Manager",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "Metaprogramming & Lifecycle",
    "description": "Event-driven product management and opportunity realization engine. Orchestrates opportunity discovery & worthwhileness research (new green-field projects vs existing product feature enhancements), strategic goal alignment, SMART requirement scoping, Eisenhower matrix prioritization, and lean vertical slice architecture.",
    "tags": [
      "product-manager",
      "product",
      "manager"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "product_name",
      "opportunity_type",
      "target_persona",
      "problem_statement",
      "worthwhileness_score",
      "strategic_goals",
      "anti_goals",
      "tested_requirements",
      "smart_requirements",
      "eisenhower_matrix",
      "vertical_slices",
      "mvp_slice_ids",
      "output_dir",
      "spec_path",
      "matrix_path"
    ],
    "defaultContext": {
      "product_name": null,
      "opportunity_type": null,
      "target_persona": null,
      "problem_statement": null,
      "worthwhileness_score": null,
      "strategic_goals": [],
      "anti_goals": [],
      "tested_requirements": [],
      "smart_requirements": [],
      "eisenhower_matrix": {
        "q1_do_now": [],
        "q2_schedule": [],
        "q3_delegate": [],
        "q4_defer_reject": []
      },
      "vertical_slices": [],
      "mvp_slice_ids": [],
      "output_dir": null,
      "spec_path": null,
      "matrix_path": null
    },
    "tools": [
      "run_command",
      "ask_question",
      "view_file",
      "list_dir",
      "search_web",
      "read_url_content",
      "grep_search",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill product-manager",
    "installCmd": "npx -y @reactive-skills/axi invoke product-manager",
    "author": "Reactive Skills Core Team",
    "stateCount": 14,
    "states": [
      {
        "name": "INIT",
        "description": "Bootloader: Verify reactive runtime environment",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "SELECT_OPPORTUNITY_TYPE"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "SETUP_RUNTIME"
          }
        ]
      },
      {
        "name": "SETUP_RUNTIME",
        "description": "Auto-configure harness MCP server or reactive CLI",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "SETUP_COMPLETE",
            "target": "SELECT_OPPORTUNITY_TYPE",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "SETUP_FAILED",
            "target": "ERROR",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "SELECT_OPPORTUNITY_TYPE",
        "description": "Classify opportunity: NEW_PRODUCT (green-field) vs PRODUCT_ENHANCEMENT (existing product feature)",
        "tools": [
          "ask_question",
          "view_file",
          "list_dir"
        ],
        "transitions": [
          {
            "signal": "OPPORTUNITY_SELECTED",
            "target": "RESEARCH_DISCOVERY",
            "guard": "context.opportunity_type != null"
          }
        ]
      },
      {
        "name": "RESEARCH_DISCOVERY",
        "description": "Investigate problem space, target persona, market/user evidence, and competitive landscape",
        "tools": [
          "search_web",
          "read_url_content",
          "view_file",
          "grep_search",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "DISCOVERY_COMPLETED",
            "target": "VALIDATE_WORTHWHILENESS"
          },
          {
            "signal": "PIVOT_INTAKE",
            "target": "SELECT_OPPORTUNITY_TYPE"
          }
        ]
      },
      {
        "name": "VALIDATE_WORTHWHILENESS",
        "description": "Assess Desirability, Feasibility, Viability, and Defensibility to verify if pursuit is worthwhile",
        "tools": [
          "ask_question",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "WORTHWHILE_CONFIRMED",
            "target": "ALIGN_GOALS"
          },
          {
            "signal": "WORTHWHILE_DOUBTFUL",
            "target": "REVIEW_GATE"
          }
        ]
      },
      {
        "name": "ALIGN_GOALS",
        "description": "Align product outcomes with overarching strategic vision, North Star metric, and explicit anti-goals",
        "tools": [
          "view_file",
          "write_to_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "GOALS_ALIGNED",
            "target": "GATHER_TEST_REQUIREMENTS"
          },
          {
            "signal": "REALIGN_RESEARCH",
            "target": "RESEARCH_DISCOVERY"
          }
        ]
      },
      {
        "name": "GATHER_TEST_REQUIREMENTS",
        "description": "Gather functional and non-functional requirements and test them with falsification checks",
        "tools": [
          "ask_question",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "REQUIREMENTS_TESTED",
            "target": "FORMULATE_SMART"
          },
          {
            "signal": "REVISE_GOALS",
            "target": "ALIGN_GOALS"
          }
        ]
      },
      {
        "name": "FORMULATE_SMART",
        "description": "Scope vetted requirements into Specific, Measurable, Achievable, Relevant, and Time-bound specifications",
        "tools": [
          "view_file",
          "write_to_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "SMART_SCOPED",
            "target": "EISENHOWER_PRIORITIZATION"
          },
          {
            "signal": "REFINE_REQUIREMENTS",
            "target": "GATHER_TEST_REQUIREMENTS"
          }
        ]
      },
      {
        "name": "EISENHOWER_PRIORITIZATION",
        "description": "Prioritize scope using Eisenhower Matrix: Q1 Do Now, Q2 Schedule, Q3 Delegate/Ops, Q4 Defer/Reject",
        "tools": [
          "ask_question",
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "PRIORITIZATION_COMPLETE",
            "target": "VERTICAL_SLICING"
          },
          {
            "signal": "REVISE_SCOPE",
            "target": "FORMULATE_SMART"
          }
        ]
      },
      {
        "name": "VERTICAL_SLICING",
        "description": "Decompose prioritized scope into end-to-end deliverable vertical slices and define MVP boundary",
        "tools": [
          "view_file",
          "write_to_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "SLICES_DECOMPOSED",
            "target": "REVIEW_GATE"
          },
          {
            "signal": "REVISE_PRIORITIES",
            "target": "EISENHOWER_PRIORITIZATION"
          }
        ]
      },
      {
        "name": "REVIEW_GATE",
        "description": "Human Gate: Review and approve consolidated Lean Product Charter, Eisenhower Matrix, and Slices",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "PROJECTING"
          },
          {
            "signal": "REVISE_SLICES",
            "target": "VERTICAL_SLICING"
          },
          {
            "signal": "REVISE_PRIORITIES",
            "target": "EISENHOWER_PRIORITIZATION"
          },
          {
            "signal": "ABORT",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "PROJECTING",
        "description": "Render and write deliverable markdown specs, matrices, and catalog inventory",
        "tools": [
          "write_to_file",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "PROJECTED",
            "target": "SUCCESS"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Terminal success state summarizing approved product slices and execution handover",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal error state with diagnostic logs and triage instructions",
        "tools": [
          "write_to_file"
        ],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INIT\n\n    INIT --> SELECT_OPPORTUNITY_TYPE: RUNTIME_READY\n    INIT --> SETUP_RUNTIME: SETUP_REQUIRED\n\n    SETUP_RUNTIME --> SELECT_OPPORTUNITY_TYPE: SETUP_COMPLETE (exit_code == 0)\n    SETUP_RUNTIME --> ERROR: SETUP_FAILED (exit_code != 0)\n\n    SELECT_OPPORTUNITY_TYPE --> RESEARCH_DISCOVERY: OPPORTUNITY_SELECTED (opportunity_type != null)\n\n    RESEARCH_DISCOVERY --> VALIDATE_WORTHWHILENESS: DISCOVERY_COMPLETED\n    RESEARCH_DISCOVERY --> SELECT_OPPORTUNITY_TYPE: PIVOT_INTAKE\n\n    VALIDATE_WORTHWHILENESS --> ALIGN_GOALS: WORTHWHILE_CONFIRMED\n    VALIDATE_WORTHWHILENESS --> REVIEW_GATE: WORTHWHILE_DOUBTFUL\n\n    ALIGN_GOALS --> GATHER_TEST_REQUIREMENTS: GOALS_ALIGNED\n    ALIGN_GOALS --> RESEARCH_DISCOVERY: REALIGN_RESEARCH\n\n    GATHER_TEST_REQUIREMENTS --> FORMULATE_SMART: REQUIREMENTS_TESTED\n    GATHER_TEST_REQUIREMENTS --> ALIGN_GOALS: REVISE_GOALS\n\n    FORMULATE_SMART --> EISENHOWER_PRIORITIZATION: SMART_SCOPED\n    FORMULATE_SMART --> GATHER_TEST_REQUIREMENTS: REFINE_REQUIREMENTS\n\n    EISENHOWER_PRIORITIZATION --> VERTICAL_SLICING: PRIORITIZATION_COMPLETE\n    EISENHOWER_PRIORITIZATION --> FORMULATE_SMART: REVISE_SCOPE\n\n    VERTICAL_SLICING --> REVIEW_GATE: SLICES_DECOMPOSED\n    VERTICAL_SLICING --> EISENHOWER_PRIORITIZATION: REVISE_PRIORITIES\n\n    REVIEW_GATE --> PROJECTING: USER_APPROVED\n    REVIEW_GATE --> VERTICAL_SLICING: REVISE_SLICES\n    REVIEW_GATE --> EISENHOWER_PRIORITIZATION: REVISE_PRIORITIES\n    REVIEW_GATE --> ERROR: ABORT\n\n    PROJECTING --> SUCCESS: PROJECTED\n\n    SUCCESS --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/product-manager/{{context.product_name}}-spec.md",
      ".docs/product-manager/{{context.product_name}}-eisenhower.md",
      ".docs/product-manager/inventory.json"
    ]
  },
  {
    "slug": "release-notes",
    "name": "Release Notes",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "General",
    "description": "Automated changelog and release note generator that scopes changes, classifies entries, composes draft notes, validates formatting, and gates human approval.",
    "tags": [
      "release-notes",
      "release",
      "notes"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "repository",
      "release_version",
      "scope_refs",
      "commits",
      "changelog_entries",
      "release_notes",
      "reviewed_notes",
      "review_decision",
      "deliverable_path"
    ],
    "defaultContext": {
      "repository": null,
      "release_version": null,
      "scope_refs": [],
      "commits": [],
      "changelog_entries": [],
      "release_notes": null,
      "reviewed_notes": null,
      "review_decision": null,
      "deliverable_path": null
    },
    "tools": [
      "view_file",
      "run_command",
      "grep_search",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill release-notes",
    "installCmd": "npx -y @reactive-skills/axi invoke release-notes",
    "author": "Reactive Skills Core Team",
    "stateCount": 9,
    "states": [
      {
        "name": "INTAKE",
        "description": "Collect repository, release version, scope refs, and format policy",
        "tools": [
          "view_file",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "INTAKE_READY",
            "target": "COLLECT",
            "guard": "event.payload.repository != null && event.payload.release_version != null && Array.isArray(event.payload.scope_refs) && event.payload.scope_refs.length > 0"
          },
          {
            "signal": "INTAKE_INVALID",
            "target": "ERROR",
            "guard": "event.payload.repository == null || event.payload.release_version == null || !Array.isArray(event.payload.scope_refs) || event.payload.scope_refs.length === 0"
          }
        ]
      },
      {
        "name": "COLLECT",
        "description": "Collect commits, artifacts, and source changes within the release scope",
        "tools": [
          "run_command",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "COLLECTION_COMPLETE",
            "target": "CLASSIFY",
            "guard": "Array.isArray(event.payload.commits) && event.payload.commits.length > 0"
          },
          {
            "signal": "COLLECTION_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.commits) || event.payload.commits.length === 0"
          }
        ]
      },
      {
        "name": "CLASSIFY",
        "description": "Classify changes into changelog categories using conventional rules",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "ENTRIES_CLASSIFIED",
            "target": "COMPOSE",
            "guard": "Array.isArray(event.payload.changelog_entries) && event.payload.changelog_entries.length > 0"
          },
          {
            "signal": "CLASSIFICATION_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.changelog_entries) || event.payload.changelog_entries.length === 0"
          }
        ]
      },
      {
        "name": "COMPOSE",
        "description": "Compose human-readable release notes from classified entries",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "NOTES_COMPOSED",
            "target": "VALIDATE",
            "guard": "event.payload.release_notes != null && event.payload.release_notes.length > 0"
          },
          {
            "signal": "COMPOSITION_FAILED",
            "target": "ERROR",
            "guard": "event.payload.release_notes == null || event.payload.release_notes.length === 0"
          }
        ]
      },
      {
        "name": "VALIDATE",
        "description": "Validate formatting, link integrity, and scope coverage",
        "tools": [
          "run_command",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "VALIDATION_PASSED",
            "target": "REVIEW",
            "guard": "event.payload.exit_code === 0"
          },
          {
            "signal": "VALIDATION_FAILED",
            "target": "ERROR",
            "guard": "event.payload.exit_code !== 0"
          }
        ]
      },
      {
        "name": "REVIEW",
        "description": "Human gate to approve, revise, or reject release notes",
        "tools": [
          "view_file"
        ],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "SUCCESS",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "USER_REQUEST_REVISIONS",
            "target": "COMPOSE",
            "guard": "event.payload.revisions_requested === true"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED",
            "guard": "event.payload.rejected === true"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Terminal state: release notes approved",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Terminal state: release notes rejected",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal state: release note workflow failed",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> COLLECT: INTAKE_READY (valid scope)\n    INTAKE --> ERROR: INTAKE_INVALID (invalid scope)\n    COLLECT --> CLASSIFY: COLLECTION_COMPLETE (commits present)\n    COLLECT --> ERROR: COLLECTION_FAILED (no commits)\n    CLASSIFY --> COMPOSE: ENTRIES_CLASSIFIED (entries present)\n    CLASSIFY --> ERROR: CLASSIFICATION_FAILED (no entries)\n    COMPOSE --> VALIDATE: NOTES_COMPOSED (notes present)\n    COMPOSE --> ERROR: COMPOSITION_FAILED (no notes)\n    VALIDATE --> REVIEW: VALIDATION_PASSED (exit_code == 0)\n    VALIDATE --> ERROR: VALIDATION_FAILED (exit_code != 0)\n    REVIEW --> SUCCESS: USER_APPROVED (approved == true)\n    REVIEW --> COMPOSE: USER_REQUEST_REVISIONS (revisions_requested == true)\n    REVIEW --> BLOCKED: USER_REJECTED (rejected == true)\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/release-notes/release-notes.md",
      ".docs/release-notes/state.json"
    ]
  },
  {
    "slug": "resume-manager",
    "name": "Resume Manager",
    "version": "2.2.0",
    "schemaVersion": "2.1.0",
    "category": "Career & Automation",
    "description": "Consolidated reactive career management engine. Orchestrates master profile bootstrapping, continuous achievement maintenance, multi-track profile specialization (Senior Technical, Practical Mid-Level, Operations Management, Client Solutions, and Adjacent Industry), and job application tailoring with automated overqualification and anti-flight risk calibration.",
    "tags": [
      "resume-manager",
      "resume",
      "manager"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "mode",
      "active_profile_id",
      "profiles_dir",
      "master_profile_path",
      "company_name",
      "target_title",
      "role_track",
      "overqualified_risk",
      "calibration_notes",
      "jd_text",
      "keywords",
      "output_dir",
      "resume_path",
      "cover_letter_path",
      "alignment_path",
      "interview_prep_path",
      "new_achievements"
    ],
    "defaultContext": {
      "mode": null,
      "active_profile_id": "senior_technical",
      "profiles_dir": null,
      "master_profile_path": null,
      "company_name": null,
      "target_title": null,
      "role_track": "senior_technical",
      "overqualified_risk": false,
      "calibration_notes": null,
      "jd_text": null,
      "keywords": [],
      "output_dir": null,
      "resume_path": null,
      "cover_letter_path": null,
      "alignment_path": null,
      "interview_prep_path": null,
      "new_achievements": []
    },
    "tools": [
      "run_command",
      "view_file",
      "find_by_name",
      "ask_question",
      "write_to_file",
      "replace_file_content"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill resume-manager",
    "installCmd": "npx -y @reactive-skills/axi invoke resume-manager",
    "author": "Reactive Skills Core Team",
    "stateCount": 20,
    "states": [
      {
        "name": "INIT",
        "description": "Bootloader: Verify reactive runtime environment",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "SELECT_MODE"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "SETUP_MCP"
          }
        ]
      },
      {
        "name": "SETUP_MCP",
        "description": "Auto-configure harness MCP server",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "SETUP_COMPLETE",
            "target": "SELECT_MODE",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "SETUP_FAILED",
            "target": "ERROR",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "SELECT_MODE",
        "description": "Determine operation mode: CUSTOMIZE, MAINTAIN, BOOTSTRAP, or MANAGE_PROFILES",
        "tools": [
          "view_file",
          "find_by_name"
        ],
        "transitions": [
          {
            "signal": "MODE_CUSTOMIZE",
            "target": "INGEST_JD"
          },
          {
            "signal": "MODE_MAINTAIN",
            "target": "INSPECT_PROFILE"
          },
          {
            "signal": "MODE_BOOTSTRAP",
            "target": "PROFILE_BOOTSTRAP"
          },
          {
            "signal": "MODE_MANAGE_PROFILES",
            "target": "MANAGE_PROFILES"
          }
        ]
      },
      {
        "name": "PROFILE_BOOTSTRAP",
        "description": "Structured career history interview for bootstrapping a new master profile",
        "tools": [
          "ask_question",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "INTERVIEW_COMPLETE",
            "target": "SYNTHESIZE_PROFILES"
          },
          {
            "signal": "ABORT_BOOTSTRAP",
            "target": "SELECT_MODE"
          }
        ]
      },
      {
        "name": "SYNTHESIZE_PROFILES",
        "description": "Synthesize master profile and generate initial multi-track profile archetypes",
        "tools": [
          "write_to_file",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "PROFILES_SYNTHESIZED",
            "target": "SUCCESS"
          }
        ]
      },
      {
        "name": "INSPECT_PROFILE",
        "description": "Inspect existing master profile and select target track to update",
        "tools": [
          "view_file",
          "find_by_name"
        ],
        "transitions": [
          {
            "signal": "PROFILE_LOADED",
            "target": "RECORD_ACCOMPLISHMENT"
          },
          {
            "signal": "NO_PROFILE_FOUND",
            "target": "PROFILE_BOOTSTRAP"
          }
        ]
      },
      {
        "name": "RECORD_ACCOMPLISHMENT",
        "description": "Capture new role, promotion, win, or skill using Google XYZ / CAR formulas",
        "tools": [
          "ask_question",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "RECORDED",
            "target": "PERSIST_PROFILE"
          },
          {
            "signal": "RECORD_MORE",
            "target": "RECORD_ACCOMPLISHMENT"
          }
        ]
      },
      {
        "name": "PERSIST_PROFILE",
        "description": "Persist updated profile records and skill taxonomies to disk",
        "tools": [
          "write_to_file",
          "replace_file_content",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "PROFILE_SAVED",
            "target": "SUCCESS"
          }
        ]
      },
      {
        "name": "MANAGE_PROFILES",
        "description": "Manage, create, or calibrate multiple specialized profile tracks",
        "tools": [
          "view_file",
          "write_to_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "PROFILES_UPDATED",
            "target": "SUCCESS"
          },
          {
            "signal": "SWITCH_TO_CUSTOMIZE",
            "target": "INGEST_JD"
          }
        ]
      },
      {
        "name": "INGEST_JD",
        "description": "Ingest job posting, extract company, title, responsibilities, and detect industry",
        "tools": [
          "view_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "JD_INGESTED",
            "target": "PROFILE_SELECTION",
            "guard": "payload.company_name != null"
          }
        ]
      },
      {
        "name": "PROFILE_SELECTION",
        "description": "Match JD to profile track and evaluate overqualification & flight-risk indicators",
        "tools": [
          "view_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "CALIBRATION_REQUIRED",
            "target": "CALIBRATE_FRAMING",
            "guard": "payload.overqualified_risk == true"
          },
          {
            "signal": "STANDARD_MATCH",
            "target": "GAP_ANALYSIS",
            "guard": "payload.overqualified_risk != true"
          }
        ]
      },
      {
        "name": "CALIBRATE_FRAMING",
        "description": "Calibrate language and intent narrative to avoid intimidating or flighty impressions",
        "tools": [
          "view_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "FRAMING_CALIBRATED",
            "target": "GAP_ANALYSIS"
          }
        ]
      },
      {
        "name": "GAP_ANALYSIS",
        "description": "Calibrate 25-35 role-specific keywords and verify candidate experience",
        "tools": [
          "view_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "ANALYSIS_COMPLETE",
            "target": "COMPANY_ALIGNMENT"
          }
        ]
      },
      {
        "name": "COMPANY_ALIGNMENT",
        "description": "Research employer context, role mission, public signals, and conversation angles",
        "tools": [
          "write_to_file",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "ALIGNMENT_DRAFTED",
            "target": "DRAFTING"
          }
        ]
      },
      {
        "name": "DRAFTING",
        "description": "Draft single-column ATS resume and tailored cover letter adhering to voice and calibration rules",
        "tools": [
          "write_to_file",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "MATERIALS_DRAFTED",
            "target": "EXPORTING"
          }
        ]
      },
      {
        "name": "EXPORTING",
        "description": "Export markdown application materials to formatted DOCX and PDF",
        "tools": [
          "run_command",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "EXPORT_COMPLETE",
            "target": "INTERVIEW_PREP",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "EXPORT_FAILED",
            "target": "ERROR",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "INTERVIEW_PREP",
        "description": "Generate strategic interview preparation artifact with pre-emptive overqualification defense",
        "tools": [
          "write_to_file",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "PREP_GENERATED",
            "target": "EVOLVE_PROFILE"
          }
        ]
      },
      {
        "name": "EVOLVE_PROFILE",
        "description": "Propose compounding newly verified skills and sharpened phrasing back to master profiles",
        "tools": [
          "write_to_file",
          "replace_file_content",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "EVOLUTION_COMPLETE",
            "target": "SUCCESS"
          },
          {
            "signal": "SKIP_EVOLUTION",
            "target": "SUCCESS"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Terminal success state with deliverable inventory",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal failure state with diagnostic logs",
        "tools": [
          "write_to_file"
        ],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INIT\n\n    INIT --> SELECT_MODE: RUNTIME_READY\n    INIT --> SETUP_MCP: SETUP_REQUIRED\n\n    SETUP_MCP --> SELECT_MODE: SETUP_COMPLETE [exit_code == 0]\n    SETUP_MCP --> ERROR: SETUP_FAILED [exit_code != 0]\n\n    state \"SELECT_MODE\" as SELECT_MODE\n    SELECT_MODE --> INGEST_JD: MODE_CUSTOMIZE\n    SELECT_MODE --> INSPECT_PROFILE: MODE_MAINTAIN\n    SELECT_MODE --> PROFILE_BOOTSTRAP: MODE_BOOTSTRAP\n    SELECT_MODE --> MANAGE_PROFILES: MODE_MANAGE_PROFILES\n\n    %% Bootstrap Track\n    state \"PROFILE_BOOTSTRAP\" as PROFILE_BOOTSTRAP\n    PROFILE_BOOTSTRAP --> SYNTHESIZE_PROFILES: INTERVIEW_COMPLETE\n    PROFILE_BOOTSTRAP --> SELECT_MODE: ABORT_BOOTSTRAP\n\n    state \"SYNTHESIZE_PROFILES\" as SYNTHESIZE_PROFILES\n    SYNTHESIZE_PROFILES --> SUCCESS: PROFILES_SYNTHESIZED\n\n    %% Maintain Track\n    state \"INSPECT_PROFILE\" as INSPECT_PROFILE\n    INSPECT_PROFILE --> RECORD_ACCOMPLISHMENT: PROFILE_LOADED\n    INSPECT_PROFILE --> PROFILE_BOOTSTRAP: NO_PROFILE_FOUND\n\n    state \"RECORD_ACCOMPLISHMENT\" as RECORD_ACCOMPLISHMENT\n    RECORD_ACCOMPLISHMENT --> PERSIST_PROFILE: RECORDED\n    RECORD_ACCOMPLISHMENT --> RECORD_ACCOMPLISHMENT: RECORD_MORE\n\n    state \"PERSIST_PROFILE\" as PERSIST_PROFILE\n    PERSIST_PROFILE --> SUCCESS: PROFILE_SAVED\n\n    %% Profile Track Management\n    state \"MANAGE_PROFILES\" as MANAGE_PROFILES\n    MANAGE_PROFILES --> SUCCESS: PROFILES_UPDATED\n    MANAGE_PROFILES --> INGEST_JD: SWITCH_TO_CUSTOMIZE\n\n    %% Customization Track\n    state \"INGEST_JD\" as INGEST_JD\n    INGEST_JD --> PROFILE_SELECTION: JD_INGESTED [company_name != null]\n\n    state \"PROFILE_SELECTION\" as PROFILE_SELECTION\n    PROFILE_SELECTION --> CALIBRATE_FRAMING: CALIBRATION_REQUIRED [overqualified_risk == true]\n    PROFILE_SELECTION --> GAP_ANALYSIS: STANDARD_MATCH [overqualified_risk != true]\n\n    state \"CALIBRATE_FRAMING\" as CALIBRATE_FRAMING\n    CALIBRATE_FRAMING --> GAP_ANALYSIS: FRAMING_CALIBRATED\n\n    state \"GAP_ANALYSIS\" as GAP_ANALYSIS\n    GAP_ANALYSIS --> COMPANY_ALIGNMENT: ANALYSIS_COMPLETE\n\n    state \"COMPANY_ALIGNMENT\" as COMPANY_ALIGNMENT\n    COMPANY_ALIGNMENT --> DRAFTING: ALIGNMENT_DRAFTED\n\n    state \"DRAFTING\" as DRAFTING\n    DRAFTING --> EXPORTING: MATERIALS_DRAFTED\n\n    state \"EXPORTING\" as EXPORTING\n    EXPORTING --> INTERVIEW_PREP: EXPORT_COMPLETE [exit_code == 0]\n    EXPORTING --> ERROR: EXPORT_FAILED [exit_code != 0]\n\n    state \"INTERVIEW_PREP\" as INTERVIEW_PREP\n    INTERVIEW_PREP --> EVOLVE_PROFILE: PREP_GENERATED\n\n    state \"EVOLVE_PROFILE\" as EVOLVE_PROFILE\n    EVOLVE_PROFILE --> SUCCESS: EVOLUTION_COMPLETE\n    EVOLVE_PROFILE --> SUCCESS: SKIP_EVOLUTION\n\n    state \"SUCCESS\" as SUCCESS\n    state \"ERROR\" as ERROR\n\n    SUCCESS --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/resume-manager/snapshot.md",
      ".docs/resume-manager/inventory.json"
    ]
  },
  {
    "slug": "security-scan",
    "name": "Security Scan",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "General",
    "description": "Pre-commit secret and credential scanner with remediation checklist — scans staged changes for API keys, tokens, private keys, hardcoded credentials, insecure defaults",
    "tags": [
      "security-scan",
      "security",
      "scan"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "COLLECT_STAGED",
    "contextKeys": [
      "staged_files",
      "scan_results",
      "secrets_found",
      "credentials_found",
      "insecure_configs",
      "findings",
      "remediation_steps",
      "pass_fail_verdict",
      "critical_findings"
    ],
    "defaultContext": {
      "staged_files": [],
      "scan_results": [],
      "secrets_found": [],
      "credentials_found": [],
      "insecure_configs": [],
      "findings": [],
      "remediation_steps": [],
      "pass_fail_verdict": null,
      "critical_findings": []
    },
    "tools": [
      "run_command",
      "view_file",
      "grep_search",
      "write_to_file"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill security-scan",
    "installCmd": "npx -y @reactive-skills/axi invoke security-scan",
    "author": "Reactive Skills Core Team",
    "stateCount": 12,
    "states": [
      {
        "name": "COLLECT_STAGED",
        "description": "Collect git-staged files for scanning",
        "tools": [
          "run_command",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "STAGED_FILES",
            "target": "SCAN_PIPELINE",
            "guard": "Array.isArray(event.payload.staged_files) && event.payload.staged_files.length > 0"
          }
        ]
      },
      {
        "name": "SCAN_PIPELINE",
        "description": "Composite state: secrets scan, credentials scan, config scan",
        "tools": [],
        "transitions": [
          {
            "signal": "CRITICAL_SECRET_FOUND",
            "target": "BLOCKED",
            "guard": "event.payload.severity === 'critical'"
          }
        ]
      },
      {
        "name": "SCAN_PIPELINE.SECRETS_SCAN",
        "description": "Scan for API keys, tokens, private keys using regex + entropy heuristics",
        "tools": [
          "run_command",
          "grep_search",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "SECRETS_SCANNED",
            "target": "SCAN_PIPELINE.CREDENTIALS_SCAN",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "SCAN_PIPELINE.CREDENTIALS_SCAN",
        "description": "Scan for hardcoded credentials (passwords, API keys in config)",
        "tools": [
          "run_command",
          "grep_search",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "CREDENTIALS_SCANNED",
            "target": "SCAN_PIPELINE.CONFIG_SCAN",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "SCAN_PIPELINE.CONFIG_SCAN",
        "description": "Scan for insecure defaults, hardcoded IPs, debug mode in production",
        "tools": [
          "run_command",
          "grep_search",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "CONFIG_SCANNED",
            "target": "REPORT",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "REPORT",
        "description": "Composite state: generate findings summary and remediation checklist",
        "tools": [],
        "transitions": [
          {
            "signal": "REPORT_ERROR",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "REPORT.VIOLATION_SUMMARY",
        "description": "Summarize all findings by severity and category",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "SUMMARY_GENERATED",
            "target": "REPORT.REMEDIATION"
          }
        ]
      },
      {
        "name": "REPORT.REMEDIATION",
        "description": "Generate actionable remediation checklist for each finding",
        "tools": [
          "view_file",
          "write_to_file"
        ],
        "transitions": [
          {
            "signal": "REMEDIATION_GENERATED",
            "target": "GATE"
          }
        ]
      },
      {
        "name": "GATE",
        "description": "Human review gate: pass, request remediation, or block",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "COMPLETED",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "REQUEST_REMEDIATION",
            "target": "SCAN_PIPELINE",
            "guard": "event.payload.remediation_requested === true"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED",
            "guard": "event.payload.rejected === true"
          }
        ]
      },
      {
        "name": "COMPLETED",
        "description": "Terminal state: Scan complete, no critical issues",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Terminal state: Critical secrets or credentials found, commit blocked",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal state: Unrecoverable error occurred",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> COLLECT_STAGED\n    COLLECT_STAGED --> SCAN_PIPELINE : STAGED_FILES\\n(guard: staged_files.length > 0)\n\n    state SCAN_PIPELINE {\n        [*] --> SECRETS_SCAN\n        SECRETS_SCAN --> CREDENTIALS_SCAN : SECRETS_SCANNED\\n(guard: exit_code === 0)\n        CREDENTIALS_SCAN --> CONFIG_SCAN : CREDENTIALS_SCANNED\\n(guard: exit_code === 0)\n        CONFIG_SCAN --> REPORT : CONFIG_SCANNED\\n(guard: exit_code === 0, exits SCAN_PIPELINE)\n    }\n\n    state REPORT {\n        [*] --> VIOLATION_SUMMARY\n        VIOLATION_SUMMARY --> REMEDIATION : SUMMARY_GENERATED\\n(guard: exit_code === 0)\n        REMEDIATION --> GATE : REMEDIATION_GENERATED\\n(guard: exit_code === 0, exits REPORT)\n    }\n\n    GATE --> COMPLETED : USER_APPROVED\\n(guard: approved === true)\n    GATE --> SCAN_PIPELINE : REQUEST_REMEDIATION\\n(guard: remediation_requested === true)\n    GATE --> BLOCKED : USER_REJECTED\\n(guard: rejected === true)\n\n    COMPLETED --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/security-scan/findings.md",
      ".docs/security-scan/remediation-checklist.md",
      ".docs/security-scan/state.json"
    ]
  },
  {
    "slug": "tdd-refactor",
    "name": "Tdd Refactor",
    "version": "2.0.2",
    "schemaVersion": "2.0.2",
    "category": "Testing & Quality",
    "description": "Hierarchical TDD & Refactoring state machine with nested micro-cycles, regression detection, event bubbling, and live projections",
    "tags": [
      "tdd-refactor",
      "tdd",
      "refactor"
    ],
    "strictExecution": true,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "target_file",
      "test_file",
      "refactor_cycles",
      "clean_passes"
    ],
    "defaultContext": {
      "target_file": "src/auth.ts",
      "test_file": "tests/auth.test.ts",
      "refactor_cycles": 0,
      "clean_passes": 0
    },
    "tools": [
      "run_command",
      "view_file",
      "write_to_file",
      "replace_file_content"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill tdd-refactor",
    "installCmd": "npx -y @reactive-skills/axi invoke tdd-refactor",
    "author": "Reactive Skills Core Team",
    "stateCount": 11,
    "states": [
      {
        "name": "INIT",
        "description": "Bootloader: Verify reactive runtime environment",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "RED_SPEC"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "SETUP_RUNTIME"
          }
        ]
      },
      {
        "name": "SETUP_RUNTIME",
        "description": "Auto-configure harness MCP server",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "SETUP_COMPLETE",
            "target": "RED_SPEC",
            "guard": "payload.exit_code == 0"
          },
          {
            "signal": "SETUP_FAILED",
            "target": "ERROR",
            "guard": "payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "RED_SPEC",
        "description": "Author a strictly failing test specifying the new requirement",
        "tools": [
          "view_file",
          "write_to_file",
          "replace_file_content",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "TEST_RAN",
            "target": "GREEN_CODE",
            "guard": "event.payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "GREEN_CODE",
        "description": "Write minimal implementation code to turn the test suite green",
        "tools": [
          "view_file",
          "write_to_file",
          "replace_file_content",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "TEST_RAN",
            "target": "REFACTOR",
            "guard": "event.payload.exit_code === 0"
          }
        ]
      },
      {
        "name": "REFACTOR",
        "description": "Composite state: Clean Code, Optimize Architecture, and Verify Invariants",
        "tools": [],
        "transitions": [
          {
            "signal": "GLOBAL_ABORT",
            "target": "RED_SPEC"
          },
          {
            "signal": "TEST_RAN",
            "target": "GREEN_CODE",
            "guard": "event.payload.exit_code != 0"
          }
        ]
      },
      {
        "name": "REFACTOR.CLEAN_CODE",
        "description": "Simplify naming, remove duplication, and extract deep helpers",
        "tools": [
          "view_file",
          "write_to_file",
          "replace_file_content",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "CLEANING_DONE",
            "target": "REFACTOR.PERF_AUDIT"
          }
        ]
      },
      {
        "name": "REFACTOR.PERF_AUDIT",
        "description": "Analyze complexity, eliminate unnecessary allocations and redundant I/O",
        "tools": [
          "view_file",
          "write_to_file",
          "replace_file_content",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "AUDIT_PASSED",
            "target": "AUDIT_VERIFY"
          }
        ]
      },
      {
        "name": "AUDIT_VERIFY",
        "description": "Run full verification suite, linter, and type checks",
        "tools": [
          "run_command",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "ALL_CHECKS_PASSED",
            "target": "COMPLETED",
            "guard": "event.payload.exit_code === 0"
          },
          {
            "signal": "REGRESSION_DETECTED",
            "target": "GREEN_CODE"
          }
        ]
      },
      {
        "name": "COMPLETED",
        "description": "TDD Refactor cycle finished successfully",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Runtime setup failed",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Terminal State: Bypass detected - Agent operated outside signal contract",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INIT\n\n    %% Bootloader\n    INIT --> RED_SPEC: RUNTIME_READY\n    INIT --> SETUP_MCP: SETUP_REQUIRED\n\n    SETUP_MCP --> RED_SPEC: SETUP_COMPLETE [exit_code == 0]\n    SETUP_MCP --> ERROR: SETUP_FAILED [exit_code != 0]\n\n    %% TDD Micro-cycle\n    RED_SPEC --> GREEN_CODE: TEST_RAN [exit_code != 0]\n    GREEN_CODE --> REFACTOR: TEST_RAN [exit_code === 0]\n\n    %% Composite state: REFACTOR with nested substates\n    state REFACTOR {\n        [*] --> CLEAN_CODE\n        CLEAN_CODE --> PERF_AUDIT: CLEANING_DONE\n        PERF_AUDIT --> AUDIT_VERIFY: AUDIT_PASSED\n    }\n\n    %% External transitions from composite REFACTOR and substates\n    REFACTOR --> RED_SPEC: GLOBAL_ABORT\n    REFACTOR --> GREEN_CODE: TEST_RAN [exit_code != 0]\n    AUDIT_VERIFY --> COMPLETED: ALL_CHECKS_PASSED [exit_code === 0]\n    AUDIT_VERIFY --> GREEN_CODE: REGRESSION_DETECTED\n\n    %% Terminal states\n    COMPLETED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/tdd-refactor-summary.md",
      ".docs/state-snapshot.json"
    ]
  },
  {
    "slug": "test-coverage-gate",
    "name": "Test Coverage Gate",
    "version": "1.0.0",
    "schemaVersion": "2.0.0",
    "category": "Testing & Quality",
    "description": "Test coverage quality gate that establishes a clean baseline, measures statement, branch, function, and line coverage, analyzes gaps, and blocks release below explicit thresholds.",
    "tags": [
      "test-coverage-gate",
      "test",
      "coverage",
      "gate"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INTAKE",
    "contextKeys": [
      "target_dir",
      "test_command",
      "coverage_command",
      "thresholds",
      "baseline_exit_code",
      "coverage_report",
      "coverage_metrics",
      "coverage_gaps",
      "gate_decision",
      "deliverable_path"
    ],
    "defaultContext": {
      "target_dir": ".",
      "test_command": null,
      "coverage_command": null,
      "thresholds": null,
      "baseline_exit_code": null,
      "coverage_report": null,
      "coverage_metrics": null,
      "coverage_gaps": [],
      "gate_decision": null,
      "deliverable_path": null
    },
    "tools": [
      "view_file",
      "run_command",
      "write_to_file",
      "grep_search"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill test-coverage-gate",
    "installCmd": "npx -y @reactive-skills/axi invoke test-coverage-gate",
    "author": "Reactive Skills Core Team",
    "stateCount": 9,
    "states": [
      {
        "name": "INTAKE",
        "description": "Collect target, test command, coverage command, and quality thresholds",
        "tools": [
          "view_file",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "INTAKE_READY",
            "target": "CONFIGURE",
            "guard": "event.payload.target_dir != null && event.payload.test_command != null && event.payload.coverage_command != null && event.payload.thresholds != null"
          },
          {
            "signal": "INTAKE_INVALID",
            "target": "ERROR",
            "guard": "event.payload.target_dir == null || event.payload.test_command == null || event.payload.coverage_command == null || event.payload.thresholds == null"
          }
        ]
      },
      {
        "name": "CONFIGURE",
        "description": "Validate commands, threshold schema, and coverage report format",
        "tools": [
          "run_command",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "CONFIGURATION_READY",
            "target": "BASELINE",
            "guard": "event.payload.exit_code === 0 && event.payload.thresholds != null"
          },
          {
            "signal": "CONFIGURATION_FAILED",
            "target": "ERROR",
            "guard": "event.payload.exit_code !== 0 || event.payload.thresholds == null"
          }
        ]
      },
      {
        "name": "BASELINE",
        "description": "Run the unmodified test suite and require a clean baseline",
        "tools": [
          "run_command"
        ],
        "transitions": [
          {
            "signal": "BASELINE_PASSED",
            "target": "MEASURE",
            "guard": "event.payload.exit_code === 0"
          },
          {
            "signal": "BASELINE_FAILED",
            "target": "ERROR",
            "guard": "event.payload.exit_code !== 0"
          }
        ]
      },
      {
        "name": "MEASURE",
        "description": "Run coverage collection and parse the machine-readable report",
        "tools": [
          "run_command",
          "view_file"
        ],
        "transitions": [
          {
            "signal": "COVERAGE_MEASURED",
            "target": "ANALYZE",
            "guard": "event.payload.coverage_report != null && event.payload.coverage_metrics != null"
          },
          {
            "signal": "MEASUREMENT_FAILED",
            "target": "ERROR",
            "guard": "event.payload.coverage_report == null || event.payload.coverage_metrics == null"
          }
        ]
      },
      {
        "name": "ANALYZE",
        "description": "Compare coverage metrics with thresholds and identify actionable gaps",
        "tools": [
          "view_file",
          "write_to_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "GAPS_ANALYZED",
            "target": "GATE",
            "guard": "event.payload.coverage_metrics != null && Array.isArray(event.payload.coverage_gaps)"
          },
          {
            "signal": "ANALYSIS_FAILED",
            "target": "ERROR",
            "guard": "event.payload.coverage_metrics == null || !Array.isArray(event.payload.coverage_gaps)"
          }
        ]
      },
      {
        "name": "GATE",
        "description": "Human quality gate for threshold exceptions and release blocking",
        "tools": [
          "view_file"
        ],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "SUCCESS",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "USER_REQUEST_REMEDIATION",
            "target": "MEASURE",
            "guard": "event.payload.remediation_requested === true"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED",
            "guard": "event.payload.rejected === true"
          }
        ]
      },
      {
        "name": "SUCCESS",
        "description": "Terminal state: coverage gate passed",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Terminal state: coverage gate blocked release",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Terminal state: coverage workflow failed",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\n    [*] --> INTAKE\n    INTAKE --> CONFIGURE: INTAKE_READY (valid intake)\n    INTAKE --> ERROR: INTAKE_INVALID (invalid intake)\n    CONFIGURE --> BASELINE: CONFIGURATION_READY (exit_code == 0)\n    CONFIGURE --> ERROR: CONFIGURATION_FAILED (invalid configuration)\n    BASELINE --> MEASURE: BASELINE_PASSED (exit_code == 0)\n    BASELINE --> ERROR: BASELINE_FAILED (exit_code != 0)\n    MEASURE --> ANALYZE: COVERAGE_MEASURED (report and metrics present)\n    MEASURE --> ERROR: MEASUREMENT_FAILED (report or metrics missing)\n    ANALYZE --> GATE: GAPS_ANALYZED (metrics and gaps present)\n    ANALYZE --> ERROR: ANALYSIS_FAILED (metrics or gaps missing)\n    GATE --> SUCCESS: USER_APPROVED (approved == true)\n    GATE --> MEASURE: USER_REQUEST_REMEDIATION (remediation_requested == true)\n    GATE --> BLOCKED: USER_REJECTED (rejected == true)\n    SUCCESS --> [*]\n    BLOCKED --> [*]\n    ERROR --> [*]",
    "deliverables": [
      ".docs/test-coverage-gate/coverage-report.md",
      ".docs/test-coverage-gate/state.json"
    ]
  }
];
