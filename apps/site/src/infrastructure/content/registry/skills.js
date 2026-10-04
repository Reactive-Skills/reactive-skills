/** @type {import('@/contracts/types').RegistrySkillDetail[]} */
// Generated automatically by scripts/sync-registry.js from Reactive-Skills/skills
export const registrySkills = [
  {
    "slug": "jsm-workflow",
    "name": "JSM Workflow",
    "version": "1.2.1",
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
    "stateCount": 20,
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
          },
          {
            "signal": "DOD_CHANGE_REQUESTED",
            "target": "ACTIVE.DOD_AMENDMENT"
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
            "target": "ACTIVE.DOD_APPROVAL"
          },
          {
            "signal": "AUDIT_REQUESTED",
            "target": "ACTIVE.AUDIT"
          },
          {
            "signal": "DIRECT_BUILD_REQUESTED",
            "target": "ACTIVE.DOD_APPROVAL"
          },
          {
            "signal": "INTAKE_BLOCKED",
            "target": "BLOCKED"
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
            "target": "ACTIVE.DOD_APPROVAL"
          },
          {
            "signal": "SCOPE_BLOCKED",
            "target": "BLOCKED"
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
            "signal": "DOD_AMENDMENT_REQUIRED",
            "target": "ACTIVE.DOD_AMENDMENT"
          },
          {
            "signal": "DECISION_DEFERRED",
            "target": "BLOCKED"
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
            "target": "ACTIVE.DOD_APPROVAL"
          },
          {
            "signal": "CONTEXT_REFRESHED",
            "target": "ACTIVE.DEVELOP"
          },
          {
            "signal": "AUDIT_TO_SCOPE",
            "target": "ACTIVE.SCOPE"
          },
          {
            "signal": "CONTEXT_BLOCKED",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "ACTIVE.DOD_APPROVAL",
        "description": "Present the complete outcome contract and collect one approval before implementation.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "ACTIVE.DEVELOP"
          },
          {
            "signal": "USER_REVISION_REQUESTED",
            "target": "ACTIVE.DOD_APPROVAL"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "ACTIVE.DOD_AMENDMENT",
        "description": "Approve a focused DoD diff after an accepted outcome or load-bearing decision changes.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "ACTIVE.AUDIT"
          },
          {
            "signal": "USER_REVISION_REQUESTED",
            "target": "ACTIVE.DOD_AMENDMENT"
          },
          {
            "signal": "USER_REJECTED",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "ACTIVE.DOD_AUDIT",
        "description": "Check every approved criterion, capture evidence, and route failures for repair.",
        "tools": [],
        "transitions": [
          {
            "signal": "DOD_CHECK_SUBMITTED",
            "target": "ACTIVE.DOD_AUDIT",
            "judgment": {
              "type": "predicate",
              "criterion": "Does the delivered output satisfy the single approved assertion in `event.contextUpdates.dod_record.active_check.question` (or `context.dod_record.active_check.question` when this signal omits it), based only on that check's `expected_result` and `evidence`?",
              "minConfidence": 0.7,
              "fallbackTarget": "ACTIVE.DEVELOP"
            }
          },
          {
            "signal": "DOD_AUDIT_PASSED",
            "target": "COMPLETE",
            "guard": "(record => Boolean(record) && Array.isArray(record.criteria) && record.criteria.length > 0 && record.criteria.every(item => item && item.status === 'passed' && typeof item.evidence === 'string' && item.evidence.trim().length > 0))((payload.contextUpdates && payload.contextUpdates.dod_record) || context.dod_record)"
          },
          {
            "signal": "DOD_AUDIT_REPAIR_REQUIRED",
            "target": "ACTIVE.DEVELOP"
          },
          {
            "signal": "DOD_AUDIT_BLOCKED",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "ACTIVE.DEVELOP",
        "description": "Implement the scoped and designed change.",
        "tools": [],
        "transitions": [
          {
            "signal": "DEBUG_NEEDED",
            "target": "ACTIVE.DEBUG"
          },
          {
            "signal": "BUILD_SKIPPED",
            "target": "ACTIVE.DOD_AUDIT"
          },
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
            "target": "BLOCKED"
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
            "target": "ACTIVE.DOD_AUDIT"
          },
          {
            "signal": "SYNC_BLOCKED",
            "target": "BLOCKED"
          }
        ]
      },
      {
        "name": "COMPLETE",
        "description": "Report success after every approved DoD criterion passes with evidence.",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BLOCKED",
        "description": "Report blocked or stopped work and its unmet DoD item or missing decision.",
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n    INIT --> ACTIVE : RUNTIME_READY\r\n    INIT --> ERROR : SETUP_REQUIRED\r\n\r\n    state ACTIVE {\r\n        [*] --> INTAKE\r\n        INTAKE --> SCOPE : WORK_REQUEST_READY\r\n        INTAKE --> DOD_APPROVAL : BUG_FIX_REQUESTED\r\n        INTAKE --> AUDIT : AUDIT_REQUESTED\r\n        INTAKE --> DOD_APPROVAL : DIRECT_BUILD_REQUESTED\r\n        INTAKE --> BLOCKED : INTAKE_BLOCKED\r\n        SCOPE --> ARCHITECT : SCOPE_READY\r\n        SCOPE --> DOD_APPROVAL : SCOPE_ONLY\r\n        SCOPE --> BLOCKED : SCOPE_BLOCKED\r\n        ARCHITECT --> AUDIT : SPEC_READY\r\n        ARCHITECT --> DOD_AMENDMENT : DOD_AMENDMENT_REQUIRED\r\n        ARCHITECT --> BLOCKED : DECISION_DEFERRED\r\n        ARCHITECT --> SCOPE : DESIGN_FLAW_CONFIRMED\r\n        AUDIT --> DOD_APPROVAL : CONTEXT_READY\r\n        AUDIT --> DEVELOP : CONTEXT_REFRESHED\r\n        AUDIT --> SCOPE : AUDIT_TO_SCOPE\r\n        AUDIT --> BLOCKED : CONTEXT_BLOCKED\r\n        DOD_APPROVAL --> DEVELOP : USER_APPROVED\r\n        DOD_APPROVAL --> DOD_APPROVAL : USER_REVISION_REQUESTED\r\n        DOD_APPROVAL --> BLOCKED : USER_REJECTED\r\n        DOD_AMENDMENT --> AUDIT : USER_APPROVED\r\n        DOD_AMENDMENT --> DOD_AMENDMENT : USER_REVISION_REQUESTED\r\n        DOD_AMENDMENT --> BLOCKED : USER_REJECTED\r\n        DOD_AUDIT --> DOD_AUDIT : DOD_CHECK_SUBMITTED [Jev probability >= 0.85]\r\n        DOD_AUDIT --> DEVELOP : DOD_CHECK_SUBMITTED [Jev probability < 0.85]\r\n        DOD_AUDIT --> COMPLETE : DOD_AUDIT_PASSED [all criteria passed with evidence]\r\n        DOD_AUDIT --> DEVELOP : DOD_AUDIT_REPAIR_REQUIRED\r\n        DOD_AUDIT --> BLOCKED : DOD_AUDIT_BLOCKED\r\n        DEVELOP --> DEBUG : DEBUG_NEEDED\r\n        DEVELOP --> DOD_AUDIT : BUILD_SKIPPED\r\n        DEVELOP --> VERIFY : BUILD_READY\r\n        DEVELOP --> ARCHITECT : DECISION_NEEDED\r\n        DEVELOP --> DEBUG : BUILD_FAILED\r\n        VERIFY --> TEST : VERIFY_PASSED\r\n        VERIFY --> DEBUG : VERIFY_FAILED\r\n        VERIFY --> TEST : VERIFY_DEFERRED\r\n        TEST --> REVIEW : TEST_PASSED\r\n        TEST --> DEBUG : TEST_FAILED\r\n        TEST --> REVIEW : TEST_DEFERRED\r\n        DEBUG --> VERIFY : BUG_FIXED\r\n        DEBUG --> ARCHITECT : DESIGN_FLAW\r\n        DEBUG --> BLOCKED : DEBUG_BLOCKED\r\n        REVIEW --> DOCUMENT : REVIEW_PASSED\r\n        REVIEW --> DEVELOP : REVIEW_FINDINGS\r\n        REVIEW --> DOCUMENT : REVIEW_DEFERRED\r\n        DOCUMENT --> SYNC : DOCUMENTED\r\n        DOCUMENT --> SYNC : DOCUMENT_DEFERRED\r\n        SYNC --> DOD_AUDIT : SYNCED\r\n        SYNC --> BLOCKED : SYNC_BLOCKED\r\n    }\r\n\r\n    ACTIVE --> ARCHITECT : DECISION_REOPENED\r\n    ACTIVE --> DOD_AMENDMENT : DOD_CHANGE_REQUESTED\r\n    COMPLETE --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]\r\n    state BYPASS_DETECTED",
    "instructionBytes": {
      "skillDocBytes": 5407,
      "stateBytes": [
        1383,
        1301,
        770,
        714,
        1011,
        1215,
        1430,
        1210,
        1232,
        1340,
        1785,
        581,
        750,
        1193,
        1301,
        1043,
        1252,
        1278,
        1340
      ]
    }
  },
  {
    "slug": "skill-manager",
    "name": "Skill Manager",
    "version": "1.3.0",
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
      "target_version",
      "authoring_source",
      "target_skill_dir",
      "manager_skill_dir"
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
    ],
    "instructionBytes": {
      "skillDocBytes": 18375,
      "stateBytes": [
        3769,
        505,
        953,
        3152,
        410,
        4946,
        2285,
        688,
        759,
        1939,
        733,
        1554,
        4719,
        625,
        243,
        1374,
        522,
        451,
        622,
        263,
        5837,
        976
      ]
    }
  },
  {
    "slug": "api-contract",
    "name": "API Contract",
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> DISCOVER_APIS\r\n    DISCOVER_APIS --> VALIDATION_PIPELINE: SPEC_LOADED [spec and code paths valid]\r\n\r\n    state VALIDATION_PIPELINE {\r\n        [*] --> SCHEMA_VALIDATION\r\n\r\n        state SCHEMA_VALIDATION {\r\n            [*] --> OPENAPI_CHECK\r\n            OPENAPI_CHECK --> TYPE_COMPATIBILITY: OPENAPI_CHECK_DONE [exit_code == 0]\r\n            TYPE_COMPATIBILITY --> BREAKING_CHANGE_DETECTION: TYPE_CHECK_DONE [exit_code == 0]\r\n            BREAKING_CHANGE_DETECTION --> EXAMPLE_CONFORMANCE: BREAKING_CHECK_DONE [exit_code == 0]\r\n        }\r\n\r\n        SCHEMA_VALIDATION --> DRIFT_DIFFING: EXAMPLE_CHECK_DONE [exit_code == 0]\r\n    }\r\n\r\n    %% External transitions from VALIDATION_PIPELINE\r\n    VALIDATION_PIPELINE --> BLOCKED: SECURITY_CRITICAL_FOUND [severity == critical]\r\n    DRIFT_DIFFING --> DRIFT_ANALYSIS: DRIFT_DIFFED [exit_code == 0]\r\n\r\n    DRIFT_ANALYSIS --> REPORT: DRIFT_CLASSIFIED\r\n    DRIFT_ANALYSIS --> BLOCKED: CRITICAL_DRIFT [severity == critical]\r\n\r\n    state REPORT {\r\n        [*] --> VIOLATION_SUMMARY\r\n        VIOLATION_SUMMARY --> FIX_RECOMMENDATIONS: SUMMARY_GENERATED\r\n    }\r\n\r\n    %% External transitions from REPORT\r\n    REPORT --> ERROR: REPORT_ERROR\r\n    FIX_RECOMMENDATIONS --> GATE: RECOMMENDATIONS_GENERATED\r\n\r\n    GATE --> COMPLETED: USER_APPROVED [approved == true]\r\n    GATE --> DRIFT_ANALYSIS: USER_REQUEST_REVISIONS [revisions_requested == true]\r\n    GATE --> BLOCKED: USER_REJECTED [rejected == true]\r\n\r\n    COMPLETED --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/api-contract/drift.md",
      ".docs/api-contract/coverage.md",
      ".docs/api-contract/state.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 2803,
      "stateBytes": [
        1076,
        452,
        1272,
        1369,
        1122,
        1237,
        1477,
        1245,
        1220,
        1028,
        1028,
        1108,
        1084
      ]
    }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> BOOT: CONFIGURE\r\n    INTAKE --> ERROR: ABORT\r\n\r\n    BOOT --> NAVIGATE: READY\r\n    BOOT --> ERROR: FAIL\r\n\r\n    NAVIGATE --> ASSERT_DOM: LOADED\r\n    NAVIGATE --> BLOCKED: NETWORK_FAIL\r\n    NAVIGATE --> ERROR: FAIL\r\n\r\n    ASSERT_DOM --> INSPECT_CONSOLE: VERIFIED\r\n    ASSERT_DOM --> BLOCKED: ASSERTION_FAIL\r\n    ASSERT_DOM --> ERROR: FAIL\r\n\r\n    INSPECT_CONSOLE --> CAPTURE_ARTIFACT: CLEAN\r\n    INSPECT_CONSOLE --> BLOCKED: ERRORS_FOUND\r\n    INSPECT_CONSOLE --> ERROR: FAIL\r\n\r\n    CAPTURE_ARTIFACT --> GATE: CAPTURED\r\n    CAPTURE_ARTIFACT --> ERROR: FAIL\r\n\r\n    GATE --> SUCCESS: APPROVE\r\n    GATE --> BLOCKED: REJECT\r\n\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "instructionBytes": {
      "skillDocBytes": 1910,
      "stateBytes": [
        482,
        352,
        433,
        452,
        274,
        430,
        493,
        490,
        503,
        304
      ]
    }
  },
  {
    "slug": "build-advisor",
    "name": "Build Advisor",
    "version": "1.0.1",
    "schemaVersion": "2.1.0",
    "category": "General",
    "description": "Develop worthwhile products, challenge existing ideas and experiences, or advise builders on product, leadership, team, business, and career decisions using contextual principles from Tony Fadell's Build.",
    "tags": [
      "build-advisor",
      "build",
      "advisor"
    ],
    "strictExecution": true,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "selected_runtime",
      "basis_version",
      "route",
      "situation",
      "evidence",
      "problem",
      "story",
      "experience",
      "learning_plan",
      "assessment",
      "uncertainty_plan",
      "diagnosis",
      "options",
      "recommendation",
      "decision",
      "action"
    ],
    "defaultContext": {
      "basis_version": 1,
      "route": null,
      "situation": null,
      "evidence": [],
      "problem": null,
      "story": null,
      "experience": null,
      "learning_plan": null,
      "assessment": null,
      "uncertainty_plan": null,
      "diagnosis": null,
      "options": null,
      "recommendation": null,
      "decision": null,
      "action": null
    },
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill build-advisor",
    "installCmd": "npx -y @reactive-skills/axi invoke build-advisor",
    "author": "Reactive Skills Core Team",
    "stateCount": 22,
    "states": [
      {
        "name": "INIT",
        "description": "Select a compatible runtime",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "ACTIVE",
            "guard": "payload.compatible === true && payload.contextUpdates?.selected_runtime?.compatible === true && payload.contextUpdates.selected_runtime.parent_dispatch_verified === true"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "BYPASS_DETECTED",
            "guard": "payload.compatible === false"
          }
        ],
        "model": {
          "tier": "fast"
        }
      },
      {
        "name": "ACTIVE",
        "description": "Shared situation and evidence; global changes bubble from any route",
        "tools": [],
        "transitions": [
          {
            "signal": "ROUTE_CHANGED",
            "target": "ACTIVE.FRAME",
            "guard": "[\"develop\",\"challenge\",\"advise\"].includes(payload.contextUpdates?.route) && typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          },
          {
            "signal": "SITUATION_CHANGED",
            "target": "ACTIVE.FRAME",
            "guard": "Number.isInteger(payload.contextUpdates?.basis_version) && payload.contextUpdates.basis_version === context.basis_version + 1 && typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          },
          {
            "signal": "CANCEL",
            "target": "CANCELLED",
            "guard": "typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          }
        ]
      },
      {
        "name": "ACTIVE.FRAME",
        "description": "Capture the decision question, stage, constraints, evidence, and requested route",
        "tools": [],
        "transitions": [
          {
            "signal": "DEVELOP_SELECTED",
            "target": "ACTIVE.DEVELOP",
            "guard": "payload.contextUpdates?.route === \"develop\" && payload.contextUpdates?.situation != null && typeof payload.contextUpdates.situation.question === \"string\" && payload.contextUpdates.situation.question.trim().length > 0 && [\"product\",\"leadership\",\"business\",\"team\",\"career\"].includes(payload.contextUpdates.situation.domain) && typeof payload.contextUpdates.situation.stage === \"string\" && payload.contextUpdates.situation.stage.trim().length > 0 && typeof payload.contextUpdates.situation.decision_owner === \"string\" && payload.contextUpdates.situation.decision_owner.trim().length > 0 && Array.isArray(payload.contextUpdates.situation.constraints) && Array.isArray(payload.contextUpdates.evidence) && payload.contextUpdates.evidence.every(e => e && typeof e.id === \"string\" && e.id.trim().length > 0 && typeof e.claim === \"string\" && e.claim.trim().length > 0 && [\"observed\",\"interpretation\",\"assumption\",\"conviction\"].includes(e.kind) && typeof e.source === \"string\" && e.source.trim().length > 0)"
          },
          {
            "signal": "CHALLENGE_SELECTED",
            "target": "ACTIVE.CHALLENGE",
            "guard": "payload.contextUpdates?.route === \"challenge\" && payload.contextUpdates?.situation != null && typeof payload.contextUpdates.situation.question === \"string\" && payload.contextUpdates.situation.question.trim().length > 0 && [\"product\",\"leadership\",\"business\",\"team\",\"career\"].includes(payload.contextUpdates.situation.domain) && typeof payload.contextUpdates.situation.stage === \"string\" && payload.contextUpdates.situation.stage.trim().length > 0 && typeof payload.contextUpdates.situation.decision_owner === \"string\" && payload.contextUpdates.situation.decision_owner.trim().length > 0 && Array.isArray(payload.contextUpdates.situation.constraints) && Array.isArray(payload.contextUpdates.evidence) && payload.contextUpdates.evidence.every(e => e && typeof e.id === \"string\" && e.id.trim().length > 0 && typeof e.claim === \"string\" && e.claim.trim().length > 0 && [\"observed\",\"interpretation\",\"assumption\",\"conviction\"].includes(e.kind) && typeof e.source === \"string\" && e.source.trim().length > 0)"
          },
          {
            "signal": "ADVISE_SELECTED",
            "target": "ACTIVE.ADVISE",
            "guard": "payload.contextUpdates?.route === \"advise\" && payload.contextUpdates?.situation != null && typeof payload.contextUpdates.situation.question === \"string\" && payload.contextUpdates.situation.question.trim().length > 0 && [\"product\",\"leadership\",\"business\",\"team\",\"career\"].includes(payload.contextUpdates.situation.domain) && typeof payload.contextUpdates.situation.stage === \"string\" && payload.contextUpdates.situation.stage.trim().length > 0 && typeof payload.contextUpdates.situation.decision_owner === \"string\" && payload.contextUpdates.situation.decision_owner.trim().length > 0 && Array.isArray(payload.contextUpdates.situation.constraints) && Array.isArray(payload.contextUpdates.evidence) && payload.contextUpdates.evidence.every(e => e && typeof e.id === \"string\" && e.id.trim().length > 0 && typeof e.claim === \"string\" && e.claim.trim().length > 0 && [\"observed\",\"interpretation\",\"assumption\",\"conviction\"].includes(e.kind) && typeof e.source === \"string\" && e.source.trim().length > 0)"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.DEVELOP",
        "description": "Make a worthwhile direction and prototype the whole customer experience",
        "tools": [],
        "transitions": [
          {
            "signal": "REVISE_PROBLEM",
            "target": "ACTIVE.DEVELOP.PROBLEM",
            "guard": "typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          }
        ]
      },
      {
        "name": "ACTIVE.DEVELOP.PROBLEM",
        "description": "Frame recurring customer pain and existing alternatives",
        "tools": [],
        "transitions": [
          {
            "signal": "PROBLEM_FRAMED",
            "target": "ACTIVE.DEVELOP.STORY",
            "guard": "payload.contextUpdates?.problem?.basis_version === context.basis_version && typeof payload.contextUpdates.problem.customer === \"string\" && payload.contextUpdates.problem.customer.trim().length > 0 && typeof payload.contextUpdates.problem.pain === \"string\" && payload.contextUpdates.problem.pain.trim().length > 0 && typeof payload.contextUpdates.problem.why_now === \"string\" && payload.contextUpdates.problem.why_now.trim().length > 0 && Array.isArray(payload.contextUpdates.problem.alternatives) && payload.contextUpdates.problem.alternatives.length > 0"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.DEVELOP.STORY",
        "description": "Explain why the product should exist and what it promises",
        "tools": [],
        "transitions": [
          {
            "signal": "STORY_READY",
            "target": "ACTIVE.DEVELOP.EXPERIENCE",
            "guard": "payload.contextUpdates?.story?.basis_version === context.basis_version && typeof payload.contextUpdates.story.narrative === \"string\" && payload.contextUpdates.story.narrative.trim().length > 0 && typeof payload.contextUpdates.story.promise === \"string\" && payload.contextUpdates.story.promise.trim().length > 0 && Array.isArray(payload.contextUpdates.story.claims)"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.DEVELOP.EXPERIENCE",
        "description": "Map and prototype every applicable journey stage",
        "tools": [],
        "transitions": [
          {
            "signal": "EXPERIENCE_READY",
            "target": "ACTIVE.DEVELOP.LEARNING",
            "guard": "payload.contextUpdates?.experience?.basis_version === context.basis_version && Array.isArray(payload.contextUpdates.experience.touchpoints) && [\"discovery\",\"evaluation\",\"acquisition\",\"onboarding\",\"use\",\"support\",\"retention\",\"exit\"].every(stage => payload.contextUpdates.experience.touchpoints.some(t => t?.stage === stage && [\"mapped\",\"needs_test\",\"not_applicable\"].includes(t.status) && typeof t.detail === \"string\" && t.detail.trim().length > 0))"
          },
          {
            "signal": "REVISE_STORY",
            "target": "ACTIVE.DEVELOP.STORY",
            "guard": "typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.DEVELOP.LEARNING",
        "description": "Define constraints, experiments, launch readiness, and later learning",
        "tools": [],
        "transitions": [
          {
            "signal": "DEVELOPMENT_READY",
            "target": "ACTIVE.DECISION",
            "guard": "payload.contextUpdates?.learning_plan?.basis_version === context.basis_version && Array.isArray(payload.contextUpdates.learning_plan.experiments) && Array.isArray(payload.contextUpdates.learning_plan.milestones) && payload.contextUpdates.learning_plan.milestones.length > 0 && typeof payload.contextUpdates.learning_plan.launch_criteria === \"string\" && payload.contextUpdates.learning_plan.launch_criteria.trim().length > 0 && typeof payload.contextUpdates.learning_plan.next_generation === \"string\" && payload.contextUpdates.learning_plan.next_generation.trim().length > 0 && payload.contextUpdates?.recommendation?.basis_version === context.basis_version && payload.contextUpdates.recommendation.route === context.route && [\"proceed\",\"revise\",\"investigate\",\"defer\",\"stop\"].includes(payload.contextUpdates.recommendation.direction) && typeof payload.contextUpdates.recommendation.rationale === \"string\" && payload.contextUpdates.recommendation.rationale.trim().length > 0 && Array.isArray(payload.contextUpdates.recommendation.limitations)"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.CHALLENGE",
        "description": "Stress-test an existing proposal without inventing defects",
        "tools": [],
        "transitions": [
          {
            "signal": "REVISE_REVIEW",
            "target": "ACTIVE.CHALLENGE.INSPECT",
            "guard": "typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          }
        ]
      },
      {
        "name": "ACTIVE.CHALLENGE.INSPECT",
        "description": "Inspect the actual proposal or experience and its promises",
        "tools": [],
        "transitions": [
          {
            "signal": "REVIEW_SCOPED",
            "target": "ACTIVE.CHALLENGE.STRESS_TEST",
            "guard": "payload.contextUpdates?.assessment?.basis_version === context.basis_version && typeof payload.contextUpdates.assessment.artifact === \"string\" && payload.contextUpdates.assessment.artifact.trim().length > 0 && typeof payload.contextUpdates.assessment.summary === \"string\" && payload.contextUpdates.assessment.summary.trim().length > 0 && Array.isArray(payload.contextUpdates.assessment.findings)"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.CHALLENGE.STRESS_TEST",
        "description": "Design bounded tests for consequential unknowns",
        "tools": [],
        "transitions": [
          {
            "signal": "TESTS_DEFINED",
            "target": "ACTIVE.CHALLENGE.VERDICT",
            "guard": "payload.contextUpdates?.uncertainty_plan?.basis_version === context.basis_version && Array.isArray(payload.contextUpdates.uncertainty_plan.tests) && (payload.contextUpdates.uncertainty_plan.tests.length > 0 || (typeof payload.contextUpdates.uncertainty_plan.no_test_reason === \"string\" && payload.contextUpdates.uncertainty_plan.no_test_reason.trim().length > 0)) && payload.contextUpdates.uncertainty_plan.tests.every(t => t && typeof t.question === \"string\" && t.question.trim().length > 0 && typeof t.method === \"string\" && t.method.trim().length > 0 && typeof t.measure === \"string\" && t.measure.trim().length > 0 && typeof t.deadline === \"string\" && t.deadline.trim().length > 0 && [\"planned\",\"observed\"].includes(t.status) && Array.isArray(t.evidence_refs) && (t.status === \"planned\" || (t.evidence_refs.length > 0 && t.evidence_refs.every(id => context.evidence.some(e => e.id === id && e.kind === \"observed\")))))"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.CHALLENGE.VERDICT",
        "description": "Recommend pursue, revise, investigate, defer, or stop with uncertainty",
        "tools": [],
        "transitions": [
          {
            "signal": "VERDICT_READY",
            "target": "ACTIVE.DECISION",
            "guard": "payload.contextUpdates?.recommendation?.basis_version === context.basis_version && payload.contextUpdates.recommendation.route === context.route && [\"proceed\",\"revise\",\"investigate\",\"defer\",\"stop\"].includes(payload.contextUpdates.recommendation.direction) && typeof payload.contextUpdates.recommendation.rationale === \"string\" && payload.contextUpdates.recommendation.rationale.trim().length > 0 && Array.isArray(payload.contextUpdates.recommendation.limitations)"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.ADVISE",
        "description": "Diagnose a concrete builder decision and compare tradeoffs",
        "tools": [],
        "transitions": [
          {
            "signal": "REVISE_DIAGNOSIS",
            "target": "ACTIVE.ADVISE.DIAGNOSE",
            "guard": "typeof payload.reason === \"string\" && payload.reason.trim().length > 0"
          }
        ]
      },
      {
        "name": "ACTIVE.ADVISE.DIAGNOSE",
        "description": "Identify the underlying builder decision and relevant principles",
        "tools": [],
        "transitions": [
          {
            "signal": "DIAGNOSIS_READY",
            "target": "ACTIVE.ADVISE.OPTIONS",
            "guard": "payload.contextUpdates?.diagnosis?.basis_version === context.basis_version && typeof payload.contextUpdates.diagnosis.issue === \"string\" && payload.contextUpdates.diagnosis.issue.trim().length > 0 && typeof payload.contextUpdates.diagnosis.decision_type === \"string\" && payload.contextUpdates.diagnosis.decision_type.trim().length > 0 && Array.isArray(payload.contextUpdates.diagnosis.principles) && payload.contextUpdates.diagnosis.principles.length > 0"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.ADVISE.OPTIONS",
        "description": "Compare feasible options and their consequences",
        "tools": [],
        "transitions": [
          {
            "signal": "OPTIONS_READY",
            "target": "ACTIVE.ADVISE.RECOMMEND",
            "guard": "payload.contextUpdates?.options?.basis_version === context.basis_version && Array.isArray(payload.contextUpdates.options.choices) && payload.contextUpdates.options.choices.length >= 2 && payload.contextUpdates.options.choices.every(o => o && typeof o.choice === \"string\" && o.choice.trim().length > 0 && typeof o.consequences === \"string\" && o.consequences.trim().length > 0)"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.ADVISE.RECOMMEND",
        "description": "Recommend a direction, responsible owner, and communication",
        "tools": [],
        "transitions": [
          {
            "signal": "ADVICE_READY",
            "target": "ACTIVE.DECISION",
            "guard": "payload.contextUpdates?.recommendation?.basis_version === context.basis_version && payload.contextUpdates.recommendation.route === context.route && [\"proceed\",\"revise\",\"investigate\",\"defer\",\"stop\"].includes(payload.contextUpdates.recommendation.direction) && typeof payload.contextUpdates.recommendation.rationale === \"string\" && payload.contextUpdates.recommendation.rationale.trim().length > 0 && Array.isArray(payload.contextUpdates.recommendation.limitations)"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.DECISION",
        "description": "Present the recommendation and obtain an explicit human decision",
        "tools": [],
        "transitions": [
          {
            "signal": "DECISION_ACCEPTED",
            "target": "ACTIVE.NEXT_ACTION",
            "guard": "payload.approved === true && typeof payload.approval_source === \"string\" && payload.approval_source.trim().length > 0 && payload.contextUpdates?.decision?.basis_version === context.basis_version && context.recommendation?.basis_version === context.basis_version && context.recommendation?.route === context.route && [\"proceed\",\"revise\",\"investigate\",\"defer\",\"stop\"].includes(payload.contextUpdates.decision.direction) && typeof payload.contextUpdates.decision.rationale === \"string\" && payload.contextUpdates.decision.rationale.trim().length > 0 && typeof payload.contextUpdates.decision.owner === \"string\" && payload.contextUpdates.decision.owner.trim().length > 0"
          },
          {
            "signal": "DECISION_REVISED",
            "target": "ACTIVE.FRAME",
            "guard": "typeof payload.feedback === \"string\" && payload.feedback.trim().length > 0"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.NEXT_ACTION",
        "description": "Assign the next action and define when to revisit the decision",
        "tools": [],
        "transitions": [
          {
            "signal": "ACTION_PLANNED",
            "target": "ACTIVE.AWAIT_EVIDENCE",
            "guard": "payload.contextUpdates?.action?.basis_version === context.basis_version && typeof payload.contextUpdates.action.owner === \"string\" && payload.contextUpdates.action.owner.trim().length > 0 && typeof payload.contextUpdates.action.next_step === \"string\" && payload.contextUpdates.action.next_step.trim().length > 0 && typeof payload.contextUpdates.action.review_trigger === \"string\" && payload.contextUpdates.action.review_trigger.trim().length > 0 && context.decision?.basis_version === context.basis_version && [\"experiment\",\"review\"].includes(payload.contextUpdates.action.type)"
          },
          {
            "signal": "HANDOFF_READY",
            "target": "COMPLETED",
            "guard": "payload.contextUpdates?.action?.basis_version === context.basis_version && typeof payload.contextUpdates.action.owner === \"string\" && payload.contextUpdates.action.owner.trim().length > 0 && typeof payload.contextUpdates.action.next_step === \"string\" && payload.contextUpdates.action.next_step.trim().length > 0 && typeof payload.contextUpdates.action.review_trigger === \"string\" && payload.contextUpdates.action.review_trigger.trim().length > 0 && context.decision?.basis_version === context.basis_version && [\"handoff\",\"stop\"].includes(payload.contextUpdates.action.type) && payload.handoff_delivered === true"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.AWAIT_EVIDENCE",
        "description": "Wait for actual external results without manufacturing progress",
        "tools": [],
        "transitions": [
          {
            "signal": "RESULTS_RECEIVED",
            "target": "ACTIVE.FRAME",
            "guard": "Number.isInteger(payload.contextUpdates?.basis_version) && payload.contextUpdates.basis_version === context.basis_version + 1 && Array.isArray(payload.contextUpdates.evidence) && Array.isArray(payload.result_refs) && payload.result_refs.length > 0 && payload.result_refs.every(id => payload.contextUpdates.evidence.some(e => e?.id === id && e.kind === \"observed\" && typeof e.claim === \"string\" && e.claim.trim().length > 0 && typeof e.source === \"string\" && e.source.trim().length > 0) && !context.evidence.some(e => e.id === id))"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "COMPLETED",
        "description": "Decision and handoff delivered",
        "tools": [],
        "transitions": [],
        "model": {
          "tier": "fast"
        }
      },
      {
        "name": "CANCELLED",
        "description": "User cancelled this advisory run",
        "tools": [],
        "transitions": [],
        "model": {
          "tier": "fast"
        }
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Stop and recover when runtime compatibility or signal contract fails",
        "tools": [],
        "transitions": [],
        "model": {
          "tier": "fast"
        }
      }
    ],
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n    state \"INIT\" as INIT\r\n    state \"ACTIVE\" as ACTIVE {\r\n        [*] --> ACTIVE__FRAME\r\n        state \"FRAME\" as ACTIVE__FRAME\r\n        state \"DEVELOP\" as ACTIVE__DEVELOP {\r\n            [*] --> ACTIVE__DEVELOP__PROBLEM\r\n            state \"PROBLEM\" as ACTIVE__DEVELOP__PROBLEM\r\n            state \"STORY\" as ACTIVE__DEVELOP__STORY\r\n            state \"EXPERIENCE\" as ACTIVE__DEVELOP__EXPERIENCE\r\n            state \"LEARNING\" as ACTIVE__DEVELOP__LEARNING\r\n        }\r\n        state \"CHALLENGE\" as ACTIVE__CHALLENGE {\r\n            [*] --> ACTIVE__CHALLENGE__INSPECT\r\n            state \"INSPECT\" as ACTIVE__CHALLENGE__INSPECT\r\n            state \"STRESS_TEST\" as ACTIVE__CHALLENGE__STRESS_TEST\r\n            state \"VERDICT\" as ACTIVE__CHALLENGE__VERDICT\r\n        }\r\n        state \"ADVISE\" as ACTIVE__ADVISE {\r\n            [*] --> ACTIVE__ADVISE__DIAGNOSE\r\n            state \"DIAGNOSE\" as ACTIVE__ADVISE__DIAGNOSE\r\n            state \"OPTIONS\" as ACTIVE__ADVISE__OPTIONS\r\n            state \"RECOMMEND\" as ACTIVE__ADVISE__RECOMMEND\r\n        }\r\n        state \"DECISION\" as ACTIVE__DECISION\r\n        state \"NEXT_ACTION\" as ACTIVE__NEXT_ACTION\r\n        state \"AWAIT_EVIDENCE\" as ACTIVE__AWAIT_EVIDENCE\r\n    }\r\n    state \"COMPLETED\" as COMPLETED\r\n    state \"CANCELLED\" as CANCELLED\r\n    state \"BYPASS_DETECTED\" as BYPASS_DETECTED\r\n    INIT --> ACTIVE : RUNTIME_READY\r\n    INIT --> BYPASS_DETECTED : SETUP_REQUIRED\r\n    ACTIVE --> ACTIVE__FRAME : ROUTE_CHANGED\r\n    ACTIVE --> ACTIVE__FRAME : SITUATION_CHANGED\r\n    ACTIVE --> CANCELLED : CANCEL\r\n    ACTIVE__FRAME --> ACTIVE__DEVELOP : DEVELOP_SELECTED\r\n    ACTIVE__FRAME --> ACTIVE__CHALLENGE : CHALLENGE_SELECTED\r\n    ACTIVE__FRAME --> ACTIVE__ADVISE : ADVISE_SELECTED\r\n    ACTIVE__DEVELOP --> ACTIVE__DEVELOP__PROBLEM : REVISE_PROBLEM\r\n    ACTIVE__DEVELOP__PROBLEM --> ACTIVE__DEVELOP__STORY : PROBLEM_FRAMED\r\n    ACTIVE__DEVELOP__STORY --> ACTIVE__DEVELOP__EXPERIENCE : STORY_READY\r\n    ACTIVE__DEVELOP__EXPERIENCE --> ACTIVE__DEVELOP__LEARNING : EXPERIENCE_READY\r\n    ACTIVE__DEVELOP__EXPERIENCE --> ACTIVE__DEVELOP__STORY : REVISE_STORY\r\n    ACTIVE__DEVELOP__LEARNING --> ACTIVE__DECISION : DEVELOPMENT_READY\r\n    ACTIVE__CHALLENGE --> ACTIVE__CHALLENGE__INSPECT : REVISE_REVIEW\r\n    ACTIVE__CHALLENGE__INSPECT --> ACTIVE__CHALLENGE__STRESS_TEST : REVIEW_SCOPED\r\n    ACTIVE__CHALLENGE__STRESS_TEST --> ACTIVE__CHALLENGE__VERDICT : TESTS_DEFINED\r\n    ACTIVE__CHALLENGE__VERDICT --> ACTIVE__DECISION : VERDICT_READY\r\n    ACTIVE__ADVISE --> ACTIVE__ADVISE__DIAGNOSE : REVISE_DIAGNOSIS\r\n    ACTIVE__ADVISE__DIAGNOSE --> ACTIVE__ADVISE__OPTIONS : DIAGNOSIS_READY\r\n    ACTIVE__ADVISE__OPTIONS --> ACTIVE__ADVISE__RECOMMEND : OPTIONS_READY\r\n    ACTIVE__ADVISE__RECOMMEND --> ACTIVE__DECISION : ADVICE_READY\r\n    ACTIVE__DECISION --> ACTIVE__NEXT_ACTION : DECISION_ACCEPTED\r\n    ACTIVE__DECISION --> ACTIVE__FRAME : DECISION_REVISED\r\n    ACTIVE__NEXT_ACTION --> ACTIVE__AWAIT_EVIDENCE : ACTION_PLANNED\r\n    ACTIVE__NEXT_ACTION --> COMPLETED : HANDOFF_READY\r\n    ACTIVE__AWAIT_EVIDENCE --> ACTIVE__FRAME : RESULTS_RECEIVED\r\n    COMPLETED --> [*]\r\n    CANCELLED --> [*]\r\n    BYPASS_DETECTED --> [*]",
    "deliverables": [
      ".docs/build-advisor/{{jobId}}/decision.md",
      ".docs/build-advisor/{{jobId}}/snapshot.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 1735,
      "stateBytes": [
        1070,
        1001,
        813,
        1042,
        1056,
        998,
        834,
        987,
        975,
        1093,
        1074,
        1228,
        868,
        917,
        954,
        1171,
        1181,
        919,
        899,
        431,
        548,
        1289
      ]
    }
  },
  {
    "slug": "ci-cd-automation",
    "name": "CI/CD Automation",
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> DETECT_STACK: CONFIGURE\r\n    INTAKE --> ERROR: ABORT\r\n\r\n    DETECT_STACK --> GENERATE_PIPELINE: DETECTED\r\n    DETECT_STACK --> ERROR: FAIL\r\n\r\n    GENERATE_PIPELINE --> LINT_WORKFLOW: GENERATED\r\n    GENERATE_PIPELINE --> ERROR: FAIL\r\n\r\n    LINT_WORKFLOW --> SECURITY_AUDIT: VALID\r\n    LINT_WORKFLOW --> BLOCKED: SYNTAX_ERROR\r\n    LINT_WORKFLOW --> ERROR: FAIL\r\n\r\n    SECURITY_AUDIT --> GATE: SECURE\r\n    SECURITY_AUDIT --> BLOCKED: VULNERABILITY_FOUND\r\n    SECURITY_AUDIT --> ERROR: FAIL\r\n\r\n    GATE --> SUCCESS: APPROVE\r\n    GATE --> BLOCKED: REJECT\r\n\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "instructionBytes": {
      "skillDocBytes": 1759,
      "stateBytes": [
        281,
        510,
        245,
        348,
        510,
        429,
        424,
        610,
        259
      ]
    }
  },
  {
    "slug": "docs-architect",
    "name": "Docs Architect",
    "version": "1.0.1",
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
        ],
        "model": {
          "tier": "reasoning"
        }
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
        ],
        "model": {
          "tier": "reasoning"
        }
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
        ],
        "model": {
          "tier": "balanced"
        }
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
            "guard": "event.payload.validation_exit_code === 0",
            "judgment": {
              "type": "predicate",
              "criterion": "payload.validation_exit_code === 0 && Array.isArray(payload.validation_checks) && payload.validation_checks.length > 0 && payload.validation_checks.every(check => check && check.passed === true)",
              "minConfidence": 0.9,
              "fallbackTarget": "ERROR"
            }
          },
          {
            "signal": "VALIDATION_FAILED",
            "target": "ERROR",
            "guard": "event.payload.validation_exit_code !== 0"
          }
        ],
        "model": {
          "tier": "fast"
        }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> DISCOVER: INTAKE_READY (valid intake)\r\n    INTAKE --> ERROR: INTAKE_INVALID (invalid intake)\r\n    DISCOVER --> EXTRACT: DISCOVERY_COMPLETE (exit_code == 0)\r\n    DISCOVER --> ERROR: DISCOVERY_FAILED (exit_code != 0)\r\n    EXTRACT --> DESIGN: FACTS_EXTRACTED (facts present)\r\n    EXTRACT --> ERROR: EXTRACTION_FAILED (no facts)\r\n    DESIGN --> AUTHOR: ARCHITECTURE_DESIGNED (decision and outline present)\r\n    DESIGN --> ERROR: DESIGN_FAILED (decision or outline missing)\r\n    AUTHOR --> DIAGRAM: DRAFT_WRITTEN (draft path present)\r\n    AUTHOR --> ERROR: AUTHORING_FAILED (draft path missing)\r\n    DIAGRAM --> VALIDATE: DIAGRAMS_EMBEDDED (diagram inventory present)\r\n    DIAGRAM --> ERROR: DIAGRAM_FAILED (diagram inventory empty)\r\n    VALIDATE --> REVIEW: VALIDATION_PASSED (exit code zero; checks pass, script predicate)\r\n    VALIDATE --> ERROR: VALIDATION_FAILED (exit_code != 0)\r\n    REVIEW --> SUCCESS: USER_APPROVED (approved == true)\r\n    REVIEW --> AUTHOR: USER_REQUEST_REVISIONS (revisions_requested == true)\r\n    REVIEW --> BLOCKED: USER_REJECTED (rejected == true)\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/docs-architect/documentation-architecture.md",
      ".docs/docs-architect/diagram-inventory.md",
      ".docs/docs-architect/state.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 2166,
      "stateBytes": [
        566,
        470,
        598,
        634,
        597,
        463,
        637,
        681,
        565,
        455,
        759
      ]
    }
  },
  {
    "slug": "experiment-loop",
    "name": "Experiment Loop",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "General",
    "description": "Run bounded, evidence-backed improvement experiments with fixed evaluators, repeated baselines, protected confirmation, budgets, and recovery.",
    "tags": [
      "experiment-loop",
      "experiment",
      "loop"
    ],
    "strictExecution": true,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [],
    "defaultContext": {
      "selected_runtime": null,
      "task": null,
      "contract": null,
      "approval": null,
      "calibration": null,
      "baseline": null,
      "incumbent": null,
      "proposal": null,
      "trial": null,
      "assessment": null,
      "progress": {
        "trials": 0,
        "seconds": 0,
        "cost": 0
      },
      "history": [],
      "pause": null,
      "confirmation": null,
      "consumed_confirmation_cases": [],
      "stop": null,
      "report": null
    },
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill experiment-loop",
    "installCmd": "npx -y @reactive-skills/axi invoke experiment-loop",
    "author": "Reactive Skills Core Team",
    "stateCount": 17,
    "states": [
      {
        "name": "INIT",
        "description": "Operational state INIT",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "ACTIVE"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "BYPASS_DETECTED"
          }
        ],
        "model": {
          "tier": "fast"
        }
      },
      {
        "name": "ACTIVE",
        "description": "Operational state ACTIVE",
        "tools": [],
        "transitions": [
          {
            "signal": "CANCEL",
            "target": "ACTIVE.FINALIZE"
          },
          {
            "signal": "DEPENDENCY_FAILED",
            "target": "ACTIVE.FINALIZE"
          },
          {
            "signal": "CONTRACT_CHANGED",
            "target": "ACTIVE.CONTRACT"
          },
          {
            "signal": "PAUSE",
            "target": "PAUSED"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.INTAKE",
        "description": "Operational state ACTIVE.INTAKE",
        "tools": [],
        "transitions": [
          {
            "signal": "INTAKE_READY",
            "target": "ACTIVE.CONTRACT"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.CONTRACT",
        "description": "Operational state ACTIVE.CONTRACT",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTRACT_APPROVED",
            "target": "ACTIVE.CALIBRATE"
          }
        ],
        "model": {
          "tier": "decision"
        }
      },
      {
        "name": "ACTIVE.CALIBRATE",
        "description": "Operational state ACTIVE.CALIBRATE",
        "tools": [],
        "transitions": [
          {
            "signal": "CALIBRATION_PASSED",
            "target": "ACTIVE.BASELINE"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.BASELINE",
        "description": "Operational state ACTIVE.BASELINE",
        "tools": [],
        "transitions": [
          {
            "signal": "BASELINE_MEASURED",
            "target": "ACTIVE.TRIAL"
          },
          {
            "signal": "BUDGET_EXHAUSTED",
            "target": "ACTIVE.FINALIZE"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.TRIAL",
        "description": "Operational state ACTIVE.TRIAL",
        "tools": [],
        "transitions": [
          {
            "signal": "SEARCH_FINISHED",
            "target": "ACTIVE.CONFIRM"
          },
          {
            "signal": "NO_CANDIDATE",
            "target": "ACTIVE.FINALIZE"
          },
          {
            "signal": "BUDGET_EXHAUSTED",
            "target": "ACTIVE.FINALIZE"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.TRIAL.DIAGNOSE",
        "description": "Operational state ACTIVE.TRIAL.DIAGNOSE",
        "tools": [],
        "transitions": [
          {
            "signal": "DIAGNOSIS_READY",
            "target": "ACTIVE.TRIAL.PROPOSE"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.TRIAL.PROPOSE",
        "description": "Operational state ACTIVE.TRIAL.PROPOSE",
        "tools": [],
        "transitions": [
          {
            "signal": "PROPOSAL_READY",
            "target": "ACTIVE.TRIAL.RUN"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.TRIAL.RUN",
        "description": "Operational state ACTIVE.TRIAL.RUN",
        "tools": [],
        "transitions": [
          {
            "signal": "TRIAL_MEASURED",
            "target": "ACTIVE.TRIAL.ASSESS"
          },
          {
            "signal": "TRIAL_FAILED",
            "target": "ACTIVE.TRIAL.ASSESS"
          },
          {
            "signal": "TRIAL_INVALID",
            "target": "ACTIVE.TRIAL.ASSESS"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "ACTIVE.TRIAL.ASSESS",
        "description": "Operational state ACTIVE.TRIAL.ASSESS",
        "tools": [],
        "transitions": [
          {
            "signal": "CANDIDATE_ACCEPTED",
            "target": "ACTIVE.TRIAL.DIAGNOSE"
          },
          {
            "signal": "CANDIDATE_REJECTED",
            "target": "ACTIVE.TRIAL.DIAGNOSE"
          }
        ],
        "model": {
          "tier": "decision"
        }
      },
      {
        "name": "ACTIVE.CONFIRM",
        "description": "Operational state ACTIVE.CONFIRM",
        "tools": [],
        "transitions": [
          {
            "signal": "CONFIRMATION_MEASURED",
            "target": "ACTIVE.FINALIZE"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "ACTIVE.FINALIZE",
        "description": "Operational state ACTIVE.FINALIZE",
        "tools": [],
        "transitions": [
          {
            "signal": "REPORT_READY",
            "target": "COMPLETE"
          },
          {
            "signal": "REPORT_BLOCKED",
            "target": "BLOCKED"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "PAUSED",
        "description": "Operational state PAUSED",
        "tools": [],
        "transitions": [
          {
            "signal": "RESUME_INTAKE",
            "target": "ACTIVE.INTAKE"
          },
          {
            "signal": "RESUME_CONTRACT",
            "target": "ACTIVE.CONTRACT"
          },
          {
            "signal": "RESUME_CALIBRATION",
            "target": "ACTIVE.CALIBRATE"
          },
          {
            "signal": "RESUME_BASELINE",
            "target": "ACTIVE.BASELINE"
          },
          {
            "signal": "RESUME_SEARCH",
            "target": "ACTIVE.TRIAL"
          },
          {
            "signal": "RESUME_FINALIZE",
            "target": "ACTIVE.FINALIZE"
          },
          {
            "signal": "CANCEL",
            "target": "ACTIVE.FINALIZE"
          },
          {
            "signal": "DEPENDENCY_FAILED",
            "target": "ACTIVE.FINALIZE"
          }
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "COMPLETE",
        "description": "Operational state COMPLETE",
        "tools": [],
        "transitions": [],
        "model": {
          "tier": "fast"
        }
      },
      {
        "name": "BLOCKED",
        "description": "Operational state BLOCKED",
        "tools": [],
        "transitions": [],
        "model": {
          "tier": "fast"
        }
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Operational state BYPASS_DETECTED",
        "tools": [],
        "transitions": [],
        "model": {
          "tier": "fast"
        }
      }
    ],
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n    state \"INIT\" as INIT\r\n    state ACTIVE {\r\n        [*] --> ACTIVE_INTAKE\r\n        state \"ACTIVE.INTAKE\" as ACTIVE_INTAKE\r\n        state \"ACTIVE.CONTRACT\" as ACTIVE_CONTRACT\r\n        state \"ACTIVE.CALIBRATE\" as ACTIVE_CALIBRATE\r\n        state \"ACTIVE.BASELINE\" as ACTIVE_BASELINE\r\n        state ACTIVE_TRIAL {\r\n            [*] --> ACTIVE_TRIAL_DIAGNOSE\r\n            state \"ACTIVE.TRIAL.DIAGNOSE\" as ACTIVE_TRIAL_DIAGNOSE\r\n            state \"ACTIVE.TRIAL.PROPOSE\" as ACTIVE_TRIAL_PROPOSE\r\n            state \"ACTIVE.TRIAL.RUN\" as ACTIVE_TRIAL_RUN\r\n            state \"ACTIVE.TRIAL.ASSESS\" as ACTIVE_TRIAL_ASSESS\r\n        }\r\n        state \"ACTIVE.CONFIRM\" as ACTIVE_CONFIRM\r\n        state \"ACTIVE.FINALIZE\" as ACTIVE_FINALIZE\r\n    }\r\n    state \"PAUSED\" as PAUSED\r\n    state \"COMPLETE\" as COMPLETE\r\n    state \"BLOCKED\" as BLOCKED\r\n    state \"BYPASS_DETECTED\" as BYPASS_DETECTED\r\n    INIT --> ACTIVE : RUNTIME_READY\r\n    INIT --> BYPASS_DETECTED : SETUP_REQUIRED\r\n    ACTIVE --> ACTIVE_FINALIZE : CANCEL\r\n    ACTIVE --> ACTIVE_FINALIZE : DEPENDENCY_FAILED\r\n    ACTIVE --> ACTIVE_CONTRACT : CONTRACT_CHANGED\r\n    ACTIVE --> PAUSED : PAUSE\r\n    ACTIVE_INTAKE --> ACTIVE_CONTRACT : INTAKE_READY\r\n    ACTIVE_CONTRACT --> ACTIVE_CALIBRATE : CONTRACT_APPROVED\r\n    ACTIVE_CALIBRATE --> ACTIVE_BASELINE : CALIBRATION_PASSED\r\n    ACTIVE_BASELINE --> ACTIVE_TRIAL : BASELINE_MEASURED\r\n    ACTIVE_BASELINE --> ACTIVE_FINALIZE : BUDGET_EXHAUSTED\r\n    ACTIVE_TRIAL --> ACTIVE_CONFIRM : SEARCH_FINISHED\r\n    ACTIVE_TRIAL --> ACTIVE_FINALIZE : NO_CANDIDATE\r\n    ACTIVE_TRIAL --> ACTIVE_FINALIZE : BUDGET_EXHAUSTED\r\n    ACTIVE_TRIAL_DIAGNOSE --> ACTIVE_TRIAL_PROPOSE : DIAGNOSIS_READY\r\n    ACTIVE_TRIAL_PROPOSE --> ACTIVE_TRIAL_RUN : PROPOSAL_READY\r\n    ACTIVE_TRIAL_RUN --> ACTIVE_TRIAL_ASSESS : TRIAL_MEASURED\r\n    ACTIVE_TRIAL_RUN --> ACTIVE_TRIAL_ASSESS : TRIAL_FAILED\r\n    ACTIVE_TRIAL_RUN --> ACTIVE_TRIAL_ASSESS : TRIAL_INVALID\r\n    ACTIVE_TRIAL_ASSESS --> ACTIVE_TRIAL_DIAGNOSE : CANDIDATE_ACCEPTED\r\n    ACTIVE_TRIAL_ASSESS --> ACTIVE_TRIAL_DIAGNOSE : CANDIDATE_REJECTED\r\n    ACTIVE_CONFIRM --> ACTIVE_FINALIZE : CONFIRMATION_MEASURED\r\n    ACTIVE_FINALIZE --> COMPLETE : REPORT_READY\r\n    ACTIVE_FINALIZE --> BLOCKED : REPORT_BLOCKED\r\n    PAUSED --> ACTIVE_INTAKE : RESUME_INTAKE\r\n    PAUSED --> ACTIVE_CONTRACT : RESUME_CONTRACT\r\n    PAUSED --> ACTIVE_CALIBRATE : RESUME_CALIBRATION\r\n    PAUSED --> ACTIVE_BASELINE : RESUME_BASELINE\r\n    PAUSED --> ACTIVE_TRIAL : RESUME_SEARCH\r\n    PAUSED --> ACTIVE_FINALIZE : RESUME_FINALIZE\r\n    PAUSED --> ACTIVE_FINALIZE : CANCEL\r\n    PAUSED --> ACTIVE_FINALIZE : DEPENDENCY_FAILED",
    "deliverables": [
      ".docs/experiment-loop/{{jobId}}/snapshot.md",
      ".docs/experiment-loop/{{jobId}}/inventory.json",
      ".docs/experiment-loop/{{jobId}}/report.md"
    ],
    "instructionBytes": {
      "skillDocBytes": 2199,
      "stateBytes": [
        680,
        675,
        703,
        584,
        883,
        677,
        648,
        683,
        368,
        714,
        528,
        687,
        245,
        204,
        306,
        503,
        758
      ]
    }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> READY\r\n\r\n    READY --> INSPECTING: START\r\n    INSPECTING --> BASELINING: CONFIGURED\r\n    INSPECTING --> ERROR: INSPECTION_FAILED\r\n\r\n    BASELINING --> MUTATING: BASELINE_PASSED (exit_code == 0)\r\n    BASELINING --> ERROR: BASELINE_FAILED (exit_code != 0)\r\n\r\n    MUTATING --> EXECUTING: MUTANTS_GENERATED\r\n    MUTATING --> ERROR: MUTATION_FAILED\r\n\r\n    EXECUTING --> PROJECTING: EXECUTION_COMPLETED\r\n    EXECUTING --> ERROR: EXECUTION_FAILED\r\n\r\n    PROJECTING --> REPORTING: PROJECTIONS_WRITTEN\r\n\r\n    REPORTING --> SUCCESS: USER_ACCEPTED\r\n    REPORTING --> BASELINING: USER_REMEDIATE\r\n\r\n    SUCCESS --> READY: RESET\r\n    ERROR --> READY: RETRY",
    "deliverables": [
      ".docs/mutation-scorecard.md",
      ".docs/mutation-report.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 2535,
      "stateBytes": [
        693,
        382,
        1052,
        864,
        939,
        715,
        716,
        684,
        312
      ]
    }
  },
  {
    "slug": "onboarding-map",
    "name": "Onboarding Map",
    "version": "1.0.3",
    "schemaVersion": "2.0.0",
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> SCAN: INGESTED\r\n    SCAN --> MAP: SCANNED\r\n    MAP --> PATH: MAPPED\r\n    PATH --> REVIEW: DESIGNED\r\n    REVIEW --> SUCCESS: APPROVED\r\n    REVIEW --> PATH: REJECTED\r\n    REVIEW --> BLOCKED: BLOCKED\r\n    SCAN --> ERROR: SCAN_FAILED\r\n    MAP --> ERROR: MAP_FAILED\r\n    PATH --> ERROR: PATH_FAILED\r\n    REVIEW --> ERROR: REVIEW_FAILED\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "instructionBytes": {
      "skillDocBytes": 2726,
      "stateBytes": [
        439,
        491,
        570,
        542,
        668,
        454,
        631,
        290
      ]
    }
  },
  {
    "slug": "pep8-review",
    "name": "PEP 8 Review",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "General",
    "description": "Reactive Python style review using PEP 8, project-specific style rules, and relevant companion conventions for docstrings and type annotations.",
    "tags": [
      "pep8-review",
      "pep8",
      "review"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "runtime",
      "review_input",
      "review_subject",
      "project_root",
      "changed_files",
      "review_scope",
      "python_version",
      "project_rules",
      "style_sources",
      "findings",
      "finding_count",
      "review_summary",
      "outcome",
      "error_reason",
      "bypass_reason"
    ],
    "defaultContext": {
      "project_root": null,
      "review_scope": null,
      "style_sources": [],
      "findings": [],
      "finding_count": 0,
      "review_summary": null,
      "outcome": null
    },
    "tools": [
      "list_dir",
      "view_file",
      "grep_search",
      "find_by_name"
    ],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill pep8-review",
    "installCmd": "npx -y @reactive-skills/axi invoke pep8-review",
    "author": "Reactive Skills Core Team",
    "stateCount": 7,
    "states": [
      {
        "name": "INIT",
        "description": "Verify reactive runtime access",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "INTAKE",
            "guard": "payload.compatible === true"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "ERROR"
          },
          {
            "signal": "BYPASS_DETECTED",
            "target": "BYPASS_DETECTED"
          }
        ]
      },
      {
        "name": "INTAKE",
        "description": "Collect review input and scope",
        "tools": [],
        "transitions": [
          {
            "signal": "INPUT_READY",
            "target": "DISCOVER_RULES",
            "guard": "payload.review_input != null && ['changed_lines', 'full_files'].includes(payload.review_scope)"
          },
          {
            "signal": "BYPASS_DETECTED",
            "target": "BYPASS_DETECTED"
          }
        ]
      },
      {
        "name": "DISCOVER_RULES",
        "description": "Read project style rules and settings",
        "tools": [
          "list_dir",
          "view_file",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "RULES_READY",
            "target": "REVIEW",
            "guard": "Array.isArray(payload.style_sources) && payload.style_sources.length > 0 && payload.project_rules != null"
          },
          {
            "signal": "BYPASS_DETECTED",
            "target": "BYPASS_DETECTED"
          }
        ]
      },
      {
        "name": "REVIEW",
        "description": "Check Python changes against applicable style rules",
        "tools": [
          "view_file",
          "find_by_name",
          "grep_search"
        ],
        "transitions": [
          {
            "signal": "REVIEW_COMPLETE",
            "target": "REPORT",
            "guard": "Array.isArray(payload.findings) && payload.finding_count === payload.findings.length && payload.outcome === (payload.findings.length === 0 ? 'no_findings' : 'findings') && payload.findings.every(item => item && item.file && Number.isInteger(item.line) && item.rule && item.explanation && item.suggestion)"
          },
          {
            "signal": "BYPASS_DETECTED",
            "target": "BYPASS_DETECTED"
          }
        ]
      },
      {
        "name": "REPORT",
        "description": "Deliver the completed style review",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Recover from work outside the signal contract",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Explain why the review could not start",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n    INIT --> INTAKE: RUNTIME_READY\r\n    INIT --> ERROR: SETUP_REQUIRED\r\n    INIT --> BYPASS_DETECTED: BYPASS_DETECTED\r\n    INTAKE --> DISCOVER_RULES: INPUT_READY (input and scope recorded)\r\n    INTAKE --> BYPASS_DETECTED: BYPASS_DETECTED\r\n    DISCOVER_RULES --> REVIEW: RULES_READY (rules and sources recorded)\r\n    DISCOVER_RULES --> BYPASS_DETECTED: BYPASS_DETECTED\r\n    REVIEW --> REPORT: REVIEW_COMPLETE (findings, count, and outcome agree)\r\n    REVIEW --> BYPASS_DETECTED: BYPASS_DETECTED\r\n    REPORT --> [*]\r\n    BYPASS_DETECTED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/pep8-review/latest-review.md",
      ".docs/pep8-review/latest-inventory.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 1411,
      "stateBytes": [
        799,
        1003,
        329,
        1208,
        811,
        533,
        1372
      ]
    }
  },
  {
    "slug": "pr-triage",
    "name": "PR Triage",
    "version": "1.0.1",
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
        ],
        "model": {
          "tier": "fast"
        }
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
            "guard": "Array.isArray(event.payload.classifications) && event.payload.classifications.length > 0",
            "judgment": {
              "type": "predicate",
              "criterion": "Array.isArray(payload.classifications) && payload.classifications.length > 0 && payload.classifications.every(item => item && item.risk && item.size && item.owner && Array.isArray(item.reviewer_classes) && item.evidence)",
              "minConfidence": 0.85,
              "fallbackTarget": "CLASSIFY"
            }
          },
          {
            "signal": "CLASSIFICATION_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.classifications) || event.payload.classifications.length === 0"
          }
        ],
        "model": {
          "tier": "balanced"
        }
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
            "guard": "Array.isArray(event.payload.assessments) && event.payload.assessments.length > 0",
            "judgment": {
              "type": "predicate",
              "criterion": "Array.isArray(payload.assessments) && payload.assessments.length > 0 && payload.assessments.every(item => item && item.status && item.evidence)",
              "minConfidence": 0.85,
              "fallbackTarget": "ASSESS"
            }
          },
          {
            "signal": "ASSESSMENT_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.assessments) || event.payload.assessments.length === 0"
          }
        ],
        "model": {
          "tier": "reasoning"
        }
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
            "guard": "Array.isArray(event.payload.routing_plan) && event.payload.routing_plan.length > 0",
            "judgment": {
              "type": "predicate",
              "criterion": "Array.isArray(payload.routing_plan) && payload.routing_plan.length > 0 && payload.routing_plan.every(item => item && item.route && Array.isArray(item.required_actions) && item.evidence)",
              "minConfidence": 0.85,
              "fallbackTarget": "ROUTE"
            }
          },
          {
            "signal": "ROUTING_FAILED",
            "target": "ERROR",
            "guard": "!Array.isArray(event.payload.routing_plan) || event.payload.routing_plan.length === 0"
          }
        ],
        "model": {
          "tier": "balanced"
        }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> COLLECT: INTAKE_READY (valid intake)\r\n    INTAKE --> ERROR: INTAKE_INVALID (invalid intake)\r\n    COLLECT --> CLASSIFY: COLLECTION_COMPLETE (items present)\r\n    COLLECT --> ERROR: COLLECTION_FAILED (no items)\r\n    CLASSIFY --> ASSESS: CLASSIFICATION_COMPLETE (complete classifications, script predicate)\r\n    CLASSIFY --> ERROR: CLASSIFICATION_FAILED (no classifications)\r\n    ASSESS --> ROUTE: ASSESSMENT_COMPLETE (complete assessments, script predicate)\r\n    ASSESS --> ERROR: ASSESSMENT_FAILED (no assessments)\r\n    ROUTE --> REVIEW: ROUTING_COMPLETE (complete routing plan, script predicate)\r\n    ROUTE --> ERROR: ROUTING_FAILED (no routing plan)\r\n    REVIEW --> SUCCESS: USER_APPROVED (approved == true)\r\n    REVIEW --> ASSESS: USER_REQUEST_REWORK (rework_requested == true)\r\n    REVIEW --> BLOCKED: USER_REJECTED (rejected == true)\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/pr-triage/triage-report.md",
      ".docs/pr-triage/state.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 1877,
      "stateBytes": [
        709,
        403,
        712,
        593,
        460,
        630,
        567,
        654,
        377
      ]
    }
  },
  {
    "slug": "product-manager",
    "name": "Product Manager",
    "version": "1.0.2",
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
        ],
        "model": {
          "tier": "reasoning"
        }
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
            "target": "ALIGN_GOALS",
            "judgment": {
              "type": "predicate",
              "criterion": "Number(payload.worthwhileness_score) >= 3 && payload.catastrophic_blocker !== true && payload.axis_scores != null && payload.axis_scores.desirability != null && payload.axis_scores.feasibility != null && payload.axis_scores.viability != null && payload.axis_scores.timing != null",
              "minConfidence": 0.85,
              "fallbackTarget": "REVIEW_GATE"
            }
          },
          {
            "signal": "WORTHWHILE_DOUBTFUL",
            "target": "REVIEW_GATE"
          }
        ],
        "model": {
          "tier": "decision"
        }
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
        ],
        "model": {
          "tier": "decision"
        }
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
        ],
        "model": {
          "tier": "reasoning"
        }
      },
      {
        "name": "REVIEW_GATE",
        "description": "Human Gate: Review and approve consolidated Lean Product Charter, Eisenhower Matrix, and Slices",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_APPROVED",
            "target": "PROJECTING",
            "judgment": {
              "type": "predicate",
              "criterion": "Number(context.worthwhileness_score) >= 3 && Array.isArray(context.strategic_goals) && Array.isArray(context.vertical_slices) && context.vertical_slices.length > 0 && Array.isArray(context.mvp_slice_ids) && context.mvp_slice_ids.length > 0",
              "minConfidence": 0.85,
              "fallbackTarget": "VERTICAL_SLICING"
            }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n\r\n    INIT --> SELECT_OPPORTUNITY_TYPE: RUNTIME_READY\r\n    INIT --> SETUP_RUNTIME: SETUP_REQUIRED\r\n\r\n    SETUP_RUNTIME --> SELECT_OPPORTUNITY_TYPE: SETUP_COMPLETE (exit_code == 0)\r\n    SETUP_RUNTIME --> ERROR: SETUP_FAILED (exit_code != 0)\r\n\r\n    SELECT_OPPORTUNITY_TYPE --> RESEARCH_DISCOVERY: OPPORTUNITY_SELECTED (opportunity_type != null)\r\n\r\n    RESEARCH_DISCOVERY --> VALIDATE_WORTHWHILENESS: DISCOVERY_COMPLETED\r\n    RESEARCH_DISCOVERY --> SELECT_OPPORTUNITY_TYPE: PIVOT_INTAKE\r\n\r\n    VALIDATE_WORTHWHILENESS --> ALIGN_GOALS: WORTHWHILE_CONFIRMED (script predicate)\r\n    VALIDATE_WORTHWHILENESS --> REVIEW_GATE: WORTHWHILE_DOUBTFUL\r\n\r\n    ALIGN_GOALS --> GATHER_TEST_REQUIREMENTS: GOALS_ALIGNED\r\n    ALIGN_GOALS --> RESEARCH_DISCOVERY: REALIGN_RESEARCH\r\n\r\n    GATHER_TEST_REQUIREMENTS --> FORMULATE_SMART: REQUIREMENTS_TESTED\r\n    GATHER_TEST_REQUIREMENTS --> ALIGN_GOALS: REVISE_GOALS\r\n\r\n    FORMULATE_SMART --> EISENHOWER_PRIORITIZATION: SMART_SCOPED\r\n    FORMULATE_SMART --> GATHER_TEST_REQUIREMENTS: REFINE_REQUIREMENTS\r\n\r\n    EISENHOWER_PRIORITIZATION --> VERTICAL_SLICING: PRIORITIZATION_COMPLETE\r\n    EISENHOWER_PRIORITIZATION --> FORMULATE_SMART: REVISE_SCOPE\r\n\r\n    VERTICAL_SLICING --> REVIEW_GATE: SLICES_DECOMPOSED\r\n    VERTICAL_SLICING --> EISENHOWER_PRIORITIZATION: REVISE_PRIORITIES\r\n\r\n    REVIEW_GATE --> PROJECTING: USER_APPROVED (script predicate)\r\n    REVIEW_GATE --> VERTICAL_SLICING: REVISE_SLICES\r\n    REVIEW_GATE --> EISENHOWER_PRIORITIZATION: REVISE_PRIORITIES\r\n    REVIEW_GATE --> ERROR: ABORT\r\n\r\n    PROJECTING --> SUCCESS: PROJECTED\r\n\r\n    SUCCESS --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/product-manager/{{context.product_name}}-spec.md",
      ".docs/product-manager/{{context.product_name}}-eisenhower.md",
      ".docs/product-manager/inventory.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 6184,
      "stateBytes": [
        1968,
        2701,
        997,
        2356,
        1941,
        687,
        1333,
        2085,
        1775,
        1664,
        1036,
        1272,
        2863,
        2736
      ]
    }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> COLLECT: INTAKE_READY (valid scope)\r\n    INTAKE --> ERROR: INTAKE_INVALID (invalid scope)\r\n    COLLECT --> CLASSIFY: COLLECTION_COMPLETE (commits present)\r\n    COLLECT --> ERROR: COLLECTION_FAILED (no commits)\r\n    CLASSIFY --> COMPOSE: ENTRIES_CLASSIFIED (entries present)\r\n    CLASSIFY --> ERROR: CLASSIFICATION_FAILED (no entries)\r\n    COMPOSE --> VALIDATE: NOTES_COMPOSED (notes present)\r\n    COMPOSE --> ERROR: COMPOSITION_FAILED (no notes)\r\n    VALIDATE --> REVIEW: VALIDATION_PASSED (exit_code == 0)\r\n    VALIDATE --> ERROR: VALIDATION_FAILED (exit_code != 0)\r\n    REVIEW --> SUCCESS: USER_APPROVED (approved == true)\r\n    REVIEW --> COMPOSE: USER_REQUEST_REVISIONS (revisions_requested == true)\r\n    REVIEW --> BLOCKED: USER_REJECTED (rejected == true)\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/release-notes/release-notes.md",
      ".docs/release-notes/state.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 1886,
      "stateBytes": [
        412,
        660,
        595,
        544,
        450,
        617,
        576,
        372,
        519
      ]
    }
  },
  {
    "slug": "research-design-planner",
    "name": "Research Design Planner",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "General",
    "description": "One reactive entry point that helps users explore, choose, plan, or review a quantitative, qualitative, or mixed methods research design.",
    "tags": [
      "research-design-planner",
      "research",
      "design",
      "planner"
    ],
    "strictExecution": true,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "requested_task",
      "study_topic",
      "research_problem",
      "research_purpose",
      "intended_audience",
      "research_questions",
      "hypotheses",
      "worldview",
      "literature_gap",
      "theory_or_framework",
      "decision_kind",
      "selected_choice",
      "selected_approach",
      "quantitative_design",
      "qualitative_strategy",
      "mixed_methods_design",
      "design_notes",
      "ethics_notes",
      "missing_information",
      "review_mode",
      "output_scope",
      "judgment_fallback"
    ],
    "defaultContext": {
      "requested_task": null,
      "study_topic": null,
      "research_problem": null,
      "research_purpose": null,
      "intended_audience": null,
      "research_questions": [],
      "hypotheses": [],
      "worldview": null,
      "literature_gap": null,
      "theory_or_framework": null,
      "decision_kind": null,
      "selected_choice": null,
      "selected_approach": null,
      "quantitative_design": null,
      "qualitative_strategy": null,
      "mixed_methods_design": null,
      "design_notes": [],
      "ethics_notes": [],
      "missing_information": [],
      "review_mode": false,
      "output_scope": null,
      "judgment_fallback": false
    },
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill research-design-planner",
    "installCmd": "npx -y @reactive-skills/axi invoke research-design-planner",
    "author": "Reactive Skills Core Team",
    "stateCount": 34,
    "states": [
      {
        "name": "INIT",
        "description": "Verify access to the reactive runtime.",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "INTAKE"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "SETUP_RUNTIME"
          }
        ]
      },
      {
        "name": "SETUP_RUNTIME",
        "description": "Explain the runtime setup requirement and wait for a user-controlled retry.",
        "tools": [],
        "transitions": [
          {
            "signal": "SETUP_COMPLETE",
            "target": "INIT"
          },
          {
            "signal": "SETUP_FAILED",
            "target": "ERROR"
          }
        ]
      },
      {
        "name": "INTAKE",
        "description": "Accept a complete request or a starting point, including uncertainty.",
        "tools": [],
        "transitions": [
          {
            "signal": "INTAKE_COMPLETE",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "NEED_CLARIFICATION",
            "target": "CLARIFY"
          },
          {
            "signal": "EXISTING_PLAN_REVIEW",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "CLARIFY",
        "description": "Resolve one decision or missing detail at a time.",
        "tools": [],
        "transitions": [
          {
            "signal": "CLARIFIED",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "ROUTE_FOUNDATIONS",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "ROUTE_APPROACH",
            "target": "DECISIONS.CHOOSE_APPROACH"
          },
          {
            "signal": "ROUTE_PROPOSAL",
            "target": "PROPOSAL.SECTION_ROUTER"
          },
          {
            "signal": "ROUTE_QUANTITATIVE",
            "target": "DECISIONS.CHOOSE_QUANTITATIVE_DESIGN"
          },
          {
            "signal": "ROUTE_QUALITATIVE",
            "target": "DECISIONS.CHOOSE_QUALITATIVE_STRATEGY"
          },
          {
            "signal": "ROUTE_MIXED_METHODS",
            "target": "DECISIONS.CHOOSE_MIXED_METHODS_DESIGN"
          },
          {
            "signal": "ROUTE_REVIEW",
            "target": "SYNTHESIZE"
          },
          {
            "signal": "USER_CANCELLED",
            "target": "DONE"
          }
        ]
      },
      {
        "name": "DECISIONS",
        "description": "Composite routing and bounded method selection.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_CANCELLED",
            "target": "DONE"
          },
          {
            "signal": "NEED_CLARIFICATION",
            "target": "CLARIFY"
          }
        ]
      },
      {
        "name": "DECISIONS.ROUTE_TASK",
        "description": "Select the smallest useful work path.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_CHOICE_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"route_task\" && [\"explore_or_clarify_goal\",\"choose_research_approach\",\"work_on_proposal_section\",\"plan_quantitative_methods\",\"plan_qualitative_methods\",\"plan_mixed_methods\",\"review_existing_plan\",\"other\"].includes(payload.choice)"
          },
          {
            "signal": "RECOMMENDATION_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"route_task\" && [\"explore_or_clarify_goal\",\"choose_research_approach\",\"work_on_proposal_section\",\"plan_quantitative_methods\",\"plan_qualitative_methods\",\"plan_mixed_methods\",\"review_existing_plan\",\"other\"].includes(payload.choice)",
            "judgment": {
              "type": "categorical",
              "criterion": "Which allowed work path best fits the user's stated need and relevant non-identifying study context?",
              "minConfidence": 0.7,
              "fallbackTarget": "CLARIFY"
            }
          }
        ]
      },
      {
        "name": "DECISIONS.CHOOSE_APPROACH",
        "description": "Select or recommend a research approach from the stated problem and purpose.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_CHOICE_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"research_approach\" && [\"quantitative\",\"qualitative\",\"mixed_methods\",\"other\"].includes(payload.choice)"
          },
          {
            "signal": "RECOMMENDATION_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"research_approach\" && [\"quantitative\",\"qualitative\",\"mixed_methods\",\"other\"].includes(payload.choice)",
            "judgment": {
              "type": "categorical",
              "criterion": "Which allowed research approach best fits the problem, purpose, questions, audience, and available information?",
              "minConfidence": 0.7,
              "fallbackTarget": "CLARIFY"
            }
          }
        ]
      },
      {
        "name": "DECISIONS.CHOOSE_QUANTITATIVE_DESIGN",
        "description": "Select or recommend a survey or experimental design.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_CHOICE_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"quantitative_design\" && [\"survey\",\"experiment\",\"other\"].includes(payload.choice)"
          },
          {
            "signal": "RECOMMENDATION_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"quantitative_design\" && [\"survey\",\"experiment\",\"other\"].includes(payload.choice)",
            "judgment": {
              "type": "categorical",
              "criterion": "Which allowed quantitative design best fits the questions, variables, comparison needs, and feasible data collection?",
              "minConfidence": 0.7,
              "fallbackTarget": "CLARIFY"
            }
          }
        ]
      },
      {
        "name": "DECISIONS.CHOOSE_QUALITATIVE_STRATEGY",
        "description": "Select or recommend a qualitative strategy.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_CHOICE_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"qualitative_strategy\" && [\"narrative\",\"phenomenology\",\"ethnography\",\"case_study\",\"grounded_theory\",\"other\"].includes(payload.choice)"
          },
          {
            "signal": "RECOMMENDATION_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"qualitative_strategy\" && [\"narrative\",\"phenomenology\",\"ethnography\",\"case_study\",\"grounded_theory\",\"other\"].includes(payload.choice)",
            "judgment": {
              "type": "categorical",
              "criterion": "Which allowed qualitative strategy best fits the phenomenon, unit of analysis, setting, and intended understanding?",
              "minConfidence": 0.7,
              "fallbackTarget": "CLARIFY"
            }
          }
        ]
      },
      {
        "name": "DECISIONS.CHOOSE_MIXED_METHODS_DESIGN",
        "description": "Select or recommend a mixed methods design.",
        "tools": [],
        "transitions": [
          {
            "signal": "USER_CHOICE_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"mixed_methods_design\" && [\"convergent\",\"explanatory_sequential\",\"exploratory_sequential\",\"complex\",\"other\"].includes(payload.choice)"
          },
          {
            "signal": "RECOMMENDATION_SUBMITTED",
            "target": "DECISIONS.DISPATCH",
            "guard": "payload.decision_kind === \"mixed_methods_design\" && [\"convergent\",\"explanatory_sequential\",\"exploratory_sequential\",\"complex\",\"other\"].includes(payload.choice)",
            "judgment": {
              "type": "categorical",
              "criterion": "Which allowed mixed methods design best fits the purpose for combining strands, their sequence, priority, and integration point?",
              "minConfidence": 0.7,
              "fallbackTarget": "CLARIFY"
            }
          }
        ]
      },
      {
        "name": "DECISIONS.DISPATCH",
        "description": "Route a validated choice using exact membership and decision-kind checks.",
        "tools": [],
        "transitions": [
          {
            "signal": "GO_FOUNDATIONS",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM",
            "guard": "context.decision_kind === \"route_task\" && context.selected_choice === \"explore_or_clarify_goal\""
          },
          {
            "signal": "GO_APPROACH",
            "target": "DECISIONS.CHOOSE_APPROACH",
            "guard": "context.decision_kind === \"route_task\" && context.selected_choice === \"choose_research_approach\""
          },
          {
            "signal": "GO_PROPOSAL",
            "target": "PROPOSAL.SECTION_ROUTER",
            "guard": "context.decision_kind === \"route_task\" && context.selected_choice === \"work_on_proposal_section\""
          },
          {
            "signal": "GO_QUANTITATIVE",
            "target": "DECISIONS.CHOOSE_QUANTITATIVE_DESIGN",
            "guard": "(context.decision_kind === \"route_task\" && context.selected_choice === \"plan_quantitative_methods\") || (context.decision_kind === \"research_approach\" && context.selected_choice === \"quantitative\")"
          },
          {
            "signal": "GO_QUALITATIVE",
            "target": "DECISIONS.CHOOSE_QUALITATIVE_STRATEGY",
            "guard": "(context.decision_kind === \"route_task\" && context.selected_choice === \"plan_qualitative_methods\") || (context.decision_kind === \"research_approach\" && context.selected_choice === \"qualitative\")"
          },
          {
            "signal": "GO_MIXED_METHODS",
            "target": "DECISIONS.CHOOSE_MIXED_METHODS_DESIGN",
            "guard": "(context.decision_kind === \"route_task\" && context.selected_choice === \"plan_mixed_methods\") || (context.decision_kind === \"research_approach\" && context.selected_choice === \"mixed_methods\")"
          },
          {
            "signal": "GO_SURVEY",
            "target": "QUANTITATIVE.SURVEY",
            "guard": "context.decision_kind === \"quantitative_design\" && context.selected_choice === \"survey\""
          },
          {
            "signal": "GO_EXPERIMENT",
            "target": "QUANTITATIVE.EXPERIMENT",
            "guard": "context.decision_kind === \"quantitative_design\" && context.selected_choice === \"experiment\""
          },
          {
            "signal": "GO_QUAL_STRATEGY",
            "target": "QUALITATIVE.ACCESS_SAMPLING_COLLECTION",
            "guard": "context.decision_kind === \"qualitative_strategy\" && [\"narrative\",\"phenomenology\",\"ethnography\",\"case_study\",\"grounded_theory\"].includes(context.selected_choice)"
          },
          {
            "signal": "GO_MIXED_DESIGN",
            "target": "MIXED_METHODS.STRAND_PROCEDURES",
            "guard": "context.decision_kind === \"mixed_methods_design\" && [\"convergent\",\"explanatory_sequential\",\"exploratory_sequential\",\"complex\"].includes(context.selected_choice)"
          },
          {
            "signal": "GO_REVIEW",
            "target": "SYNTHESIZE",
            "guard": "context.decision_kind === \"route_task\" && context.selected_choice === \"review_existing_plan\""
          },
          {
            "signal": "GO_CLARIFY",
            "target": "CLARIFY",
            "guard": "context.selected_choice === \"other\" || context.selected_choice == null || context.judgment_fallback === true"
          }
        ]
      },
      {
        "name": "FOUNDATIONS",
        "description": "Composite foundations for problem framing, literature, theory, writing, and ethics.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_ROUTER",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "RETURN_TO_INTAKE",
            "target": "INTAKE"
          },
          {
            "signal": "FINISH_SECTION",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "FOUNDATIONS.TOPIC_AND_PROBLEM",
        "description": "Shape a feasible research problem from a topic or concern.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTINUE_TO_LITERATURE",
            "target": "FOUNDATIONS.LITERATURE_AND_THEORY"
          },
          {
            "signal": "CONTINUE_TO_ETHICS",
            "target": "FOUNDATIONS.WRITING_AND_ETHICS"
          },
          {
            "signal": "SELECT_APPROACH",
            "target": "DECISIONS.CHOOSE_APPROACH"
          },
          {
            "signal": "SELECT_PROPOSAL_SECTION",
            "target": "PROPOSAL.SECTION_ROUTER"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "FOUNDATIONS.LITERATURE_AND_THEORY",
        "description": "Frame a literature review, gap, and role for theory or a conceptual framework.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTINUE_TO_PROBLEM",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "CONTINUE_TO_ETHICS",
            "target": "FOUNDATIONS.WRITING_AND_ETHICS"
          },
          {
            "signal": "SELECT_APPROACH",
            "target": "DECISIONS.CHOOSE_APPROACH"
          },
          {
            "signal": "SELECT_PROPOSAL_SECTION",
            "target": "PROPOSAL.SECTION_ROUTER"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "FOUNDATIONS.WRITING_AND_ETHICS",
        "description": "Apply writing and ethics considerations throughout the design.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_PROBLEM",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "SELECT_APPROACH",
            "target": "DECISIONS.CHOOSE_APPROACH"
          },
          {
            "signal": "SELECT_PROPOSAL_SECTION",
            "target": "PROPOSAL.SECTION_ROUTER"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "PROPOSAL",
        "description": "Composite route for introduction, purpose or aim, and questions or hypotheses.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_FOUNDATIONS",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "RETURN_TO_ROUTER",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "FINISH_SECTION",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "PROPOSAL.SECTION_ROUTER",
        "description": "Choose the requested proposal section and load only that prompt.",
        "tools": [],
        "transitions": [
          {
            "signal": "SECTION_INTRODUCTION",
            "target": "PROPOSAL.INTRODUCTION"
          },
          {
            "signal": "SECTION_PURPOSE",
            "target": "PROPOSAL.PURPOSE_AND_AIM"
          },
          {
            "signal": "SECTION_QUESTIONS",
            "target": "PROPOSAL.QUESTIONS_AND_HYPOTHESES"
          },
          {
            "signal": "SECTION_OTHER",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          }
        ]
      },
      {
        "name": "PROPOSAL.INTRODUCTION",
        "description": "Build the proposal introduction and justify the study.",
        "tools": [],
        "transitions": [
          {
            "signal": "SECTION_PURPOSE",
            "target": "PROPOSAL.PURPOSE_AND_AIM"
          },
          {
            "signal": "SECTION_QUESTIONS",
            "target": "PROPOSAL.QUESTIONS_AND_HYPOTHESES"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "PROPOSAL.PURPOSE_AND_AIM",
        "description": "State the study purpose or aim and its alignment.",
        "tools": [],
        "transitions": [
          {
            "signal": "SECTION_INTRODUCTION",
            "target": "PROPOSAL.INTRODUCTION"
          },
          {
            "signal": "SECTION_QUESTIONS",
            "target": "PROPOSAL.QUESTIONS_AND_HYPOTHESES"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "PROPOSAL.QUESTIONS_AND_HYPOTHESES",
        "description": "Form questions or quantitative hypotheses aligned with the purpose.",
        "tools": [],
        "transitions": [
          {
            "signal": "SECTION_INTRODUCTION",
            "target": "PROPOSAL.INTRODUCTION"
          },
          {
            "signal": "SECTION_PURPOSE",
            "target": "PROPOSAL.PURPOSE_AND_AIM"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUANTITATIVE",
        "description": "Composite survey, experiment, analysis, preregistration, and validity path.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_ROUTER",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "RETURN_TO_FOUNDATIONS",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "FINISH_DESIGN",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUANTITATIVE.SURVEY",
        "description": "Plan survey purpose, population, sampling, instrument, administration, and analysis.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTINUE_TO_ANALYSIS",
            "target": "QUANTITATIVE.ANALYSIS_PREREGISTRATION_VALIDITY"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUANTITATIVE.EXPERIMENT",
        "description": "Plan an experiment, comparison, assignment, measures, procedure, and analysis.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTINUE_TO_ANALYSIS",
            "target": "QUANTITATIVE.ANALYSIS_PREREGISTRATION_VALIDITY"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUANTITATIVE.ANALYSIS_PREREGISTRATION_VALIDITY",
        "description": "Align quantitative analysis, preregistration, validity, reliability, and interpretation.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_SURVEY",
            "target": "QUANTITATIVE.SURVEY"
          },
          {
            "signal": "RETURN_TO_EXPERIMENT",
            "target": "QUANTITATIVE.EXPERIMENT"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUALITATIVE",
        "description": "Composite qualitative strategy, access, sampling, collection, analysis, and reporting path.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_ROUTER",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "RETURN_TO_FOUNDATIONS",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "FINISH_DESIGN",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUALITATIVE.ACCESS_SAMPLING_COLLECTION",
        "description": "Plan strategy-specific access, researcher role, sampling, and collection.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTINUE_TO_ANALYSIS",
            "target": "QUALITATIVE.ANALYSIS_VALIDATION_REPORTING"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "QUALITATIVE.ANALYSIS_VALIDATION_REPORTING",
        "description": "Plan iterative analysis, validation, and qualitative reporting.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_COLLECTION",
            "target": "QUALITATIVE.ACCESS_SAMPLING_COLLECTION"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "MIXED_METHODS",
        "description": "Composite mixed methods strand procedures, integration, and interpretation path.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_ROUTER",
            "target": "DECISIONS.ROUTE_TASK"
          },
          {
            "signal": "RETURN_TO_FOUNDATIONS",
            "target": "FOUNDATIONS.TOPIC_AND_PROBLEM"
          },
          {
            "signal": "FINISH_DESIGN",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "MIXED_METHODS.STRAND_PROCEDURES",
        "description": "Plan both strands and align order, priority, and timing with the selected design.",
        "tools": [],
        "transitions": [
          {
            "signal": "CONTINUE_TO_INTEGRATION",
            "target": "MIXED_METHODS.INTEGRATION_AND_INTERPRETATION"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "MIXED_METHODS.INTEGRATION_AND_INTERPRETATION",
        "description": "Specify integration points, joint displays, and mixed methods interpretations.",
        "tools": [],
        "transitions": [
          {
            "signal": "RETURN_TO_STRANDS",
            "target": "MIXED_METHODS.STRAND_PROCEDURES"
          },
          {
            "signal": "ASK_CLARIFY",
            "target": "CLARIFY"
          },
          {
            "signal": "SYNTHESIZE",
            "target": "SYNTHESIZE"
          }
        ]
      },
      {
        "name": "SYNTHESIZE",
        "description": "Produce the requested focused design brief or proposal section outline.",
        "tools": [],
        "transitions": [
          {
            "signal": "DELIVERED",
            "target": "DONE"
          },
          {
            "signal": "REFINE",
            "target": "CLARIFY"
          },
          {
            "signal": "CONTINUE_DESIGN",
            "target": "DECISIONS.ROUTE_TASK"
          }
        ]
      },
      {
        "name": "DONE",
        "description": "Requested research design work has been delivered.",
        "tools": [],
        "transitions": []
      },
      {
        "name": "ERROR",
        "description": "Runtime is unavailable or a required operation failed.",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Terminal recovery state for work outside the reactive signal contract.",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\r\n  [*] --> INIT\r\n  INIT --> INTAKE: RUNTIME_READY\r\n  INIT --> SETUP_RUNTIME: SETUP_REQUIRED\r\n  SETUP_RUNTIME --> INIT: SETUP_COMPLETE\r\n  SETUP_RUNTIME --> ERROR: SETUP_FAILED\r\n  INTAKE --> DECISIONS: INTAKE_COMPLETE\r\n  INTAKE --> CLARIFY: NEED_CLARIFICATION\r\n  INTAKE --> SYNTHESIZE: EXISTING_PLAN_REVIEW\r\n  CLARIFY --> DECISIONS: CLARIFIED\r\n  CLARIFY --> FOUNDATIONS: ROUTE_FOUNDATIONS\r\n  CLARIFY --> DECISIONS: ROUTE_APPROACH\r\n  CLARIFY --> DECISIONS: ROUTE_QUANTITATIVE\r\n  CLARIFY --> DECISIONS: ROUTE_QUALITATIVE\r\n  CLARIFY --> DECISIONS: ROUTE_MIXED_METHODS\r\n  CLARIFY --> PROPOSAL: ROUTE_PROPOSAL\r\n  CLARIFY --> SYNTHESIZE: ROUTE_REVIEW\r\n  CLARIFY --> DONE: USER_CANCELLED\r\n\r\n  state DECISIONS {\r\n    [*] --> ROUTE_TASK\r\n    ROUTE_TASK --> DISPATCH: USER_CHOICE_SUBMITTED [route_task option]\r\n    ROUTE_TASK --> DISPATCH: RECOMMENDATION_SUBMITTED [route_task option, confidence at least 0.7]\r\n    CHOOSE_APPROACH --> DISPATCH: USER_CHOICE_SUBMITTED [approach option]\r\n    CHOOSE_APPROACH --> DISPATCH: RECOMMENDATION_SUBMITTED [approach option, confidence at least 0.7]\r\n    CHOOSE_QUANTITATIVE_DESIGN --> DISPATCH: USER_CHOICE_SUBMITTED [quantitative design option]\r\n    CHOOSE_QUANTITATIVE_DESIGN --> DISPATCH: RECOMMENDATION_SUBMITTED [quantitative design option, confidence at least 0.7]\r\n    CHOOSE_QUALITATIVE_STRATEGY --> DISPATCH: USER_CHOICE_SUBMITTED [qualitative strategy option]\r\n    CHOOSE_QUALITATIVE_STRATEGY --> DISPATCH: RECOMMENDATION_SUBMITTED [qualitative strategy option, confidence at least 0.7]\r\n    CHOOSE_MIXED_METHODS_DESIGN --> DISPATCH: USER_CHOICE_SUBMITTED [mixed methods design option]\r\n    CHOOSE_MIXED_METHODS_DESIGN --> DISPATCH: RECOMMENDATION_SUBMITTED [mixed methods design option, confidence at least 0.7]\r\n    DISPATCH --> CHOOSE_APPROACH: GO_APPROACH\r\n    DISPATCH --> CHOOSE_QUANTITATIVE_DESIGN: GO_QUANTITATIVE\r\n    DISPATCH --> CHOOSE_QUALITATIVE_STRATEGY: GO_QUALITATIVE\r\n    DISPATCH --> CHOOSE_MIXED_METHODS_DESIGN: GO_MIXED_METHODS\r\n  }\r\n\r\n  state FOUNDATIONS {\r\n    [*] --> TOPIC_AND_PROBLEM\r\n    TOPIC_AND_PROBLEM --> LITERATURE_AND_THEORY: CONTINUE_TO_LITERATURE\r\n    TOPIC_AND_PROBLEM --> WRITING_AND_ETHICS: CONTINUE_TO_ETHICS\r\n    LITERATURE_AND_THEORY --> TOPIC_AND_PROBLEM: CONTINUE_TO_PROBLEM\r\n    LITERATURE_AND_THEORY --> WRITING_AND_ETHICS: CONTINUE_TO_ETHICS\r\n    WRITING_AND_ETHICS --> TOPIC_AND_PROBLEM: RETURN_TO_PROBLEM\r\n  }\r\n\r\n  state PROPOSAL {\r\n    [*] --> SECTION_ROUTER\r\n    SECTION_ROUTER --> INTRODUCTION: SECTION_INTRODUCTION\r\n    SECTION_ROUTER --> PURPOSE_AND_AIM: SECTION_PURPOSE\r\n    SECTION_ROUTER --> QUESTIONS_AND_HYPOTHESES: SECTION_QUESTIONS\r\n    INTRODUCTION --> PURPOSE_AND_AIM: SECTION_PURPOSE\r\n    INTRODUCTION --> QUESTIONS_AND_HYPOTHESES: SECTION_QUESTIONS\r\n    PURPOSE_AND_AIM --> INTRODUCTION: SECTION_INTRODUCTION\r\n    PURPOSE_AND_AIM --> QUESTIONS_AND_HYPOTHESES: SECTION_QUESTIONS\r\n    QUESTIONS_AND_HYPOTHESES --> INTRODUCTION: SECTION_INTRODUCTION\r\n    QUESTIONS_AND_HYPOTHESES --> PURPOSE_AND_AIM: SECTION_PURPOSE\r\n  }\r\n\r\n  state QUANTITATIVE {\r\n    [*] --> SURVEY\r\n    SURVEY --> ANALYSIS_PREREGISTRATION_VALIDITY: CONTINUE_TO_ANALYSIS\r\n    EXPERIMENT --> ANALYSIS_PREREGISTRATION_VALIDITY: CONTINUE_TO_ANALYSIS\r\n    ANALYSIS_PREREGISTRATION_VALIDITY --> SURVEY: RETURN_TO_SURVEY\r\n    ANALYSIS_PREREGISTRATION_VALIDITY --> EXPERIMENT: RETURN_TO_EXPERIMENT\r\n  }\r\n\r\n  state QUALITATIVE {\r\n    [*] --> ACCESS_SAMPLING_COLLECTION\r\n    ACCESS_SAMPLING_COLLECTION --> ANALYSIS_VALIDATION_REPORTING: CONTINUE_TO_ANALYSIS\r\n    ANALYSIS_VALIDATION_REPORTING --> ACCESS_SAMPLING_COLLECTION: RETURN_TO_COLLECTION\r\n  }\r\n\r\n  state MIXED_METHODS {\r\n    [*] --> STRAND_PROCEDURES\r\n    STRAND_PROCEDURES --> INTEGRATION_AND_INTERPRETATION: CONTINUE_TO_INTEGRATION\r\n    INTEGRATION_AND_INTERPRETATION --> STRAND_PROCEDURES: RETURN_TO_STRANDS\r\n  }\r\n\r\n  DECISIONS --> DONE: USER_CANCELLED\r\n  DECISIONS --> CLARIFY: NEED_CLARIFICATION\r\n  DECISIONS --> CLARIFY: CHILD RECOMMENDATION_FALLBACK\r\n  DECISIONS --> FOUNDATIONS: DISPATCH GO_FOUNDATIONS\r\n  DECISIONS --> PROPOSAL: DISPATCH GO_PROPOSAL\r\n  DECISIONS --> QUANTITATIVE: DISPATCH GO_SURVEY or GO_EXPERIMENT\r\n  DECISIONS --> QUALITATIVE: DISPATCH GO_QUAL_STRATEGY\r\n  DECISIONS --> MIXED_METHODS: DISPATCH GO_MIXED_DESIGN\r\n  DECISIONS --> SYNTHESIZE: DISPATCH GO_REVIEW\r\n  DECISIONS --> CLARIFY: DISPATCH GO_CLARIFY\r\n  FOUNDATIONS --> DECISIONS: RETURN_TO_ROUTER\r\n  FOUNDATIONS --> INTAKE: RETURN_TO_INTAKE\r\n  FOUNDATIONS --> SYNTHESIZE: FINISH_SECTION\r\n  FOUNDATIONS --> DECISIONS: LEAF SELECT_APPROACH\r\n  FOUNDATIONS --> PROPOSAL: LEAF SELECT_PROPOSAL_SECTION\r\n  FOUNDATIONS --> CLARIFY: LEAF ASK_CLARIFY\r\n  FOUNDATIONS --> SYNTHESIZE: LEAF SYNTHESIZE\r\n  PROPOSAL --> FOUNDATIONS: RETURN_TO_FOUNDATIONS\r\n  PROPOSAL --> DECISIONS: RETURN_TO_ROUTER\r\n  PROPOSAL --> SYNTHESIZE: FINISH_SECTION\r\n  PROPOSAL --> FOUNDATIONS: SECTION_ROUTER SECTION_OTHER\r\n  PROPOSAL --> CLARIFY: LEAF ASK_CLARIFY\r\n  PROPOSAL --> SYNTHESIZE: LEAF SYNTHESIZE\r\n  QUANTITATIVE --> DECISIONS: RETURN_TO_ROUTER\r\n  QUANTITATIVE --> FOUNDATIONS: RETURN_TO_FOUNDATIONS\r\n  QUANTITATIVE --> SYNTHESIZE: FINISH_DESIGN\r\n  QUANTITATIVE --> CLARIFY: LEAF ASK_CLARIFY\r\n  QUANTITATIVE --> SYNTHESIZE: LEAF SYNTHESIZE\r\n  QUALITATIVE --> DECISIONS: RETURN_TO_ROUTER\r\n  QUALITATIVE --> FOUNDATIONS: RETURN_TO_FOUNDATIONS\r\n  QUALITATIVE --> SYNTHESIZE: FINISH_DESIGN\r\n  QUALITATIVE --> CLARIFY: LEAF ASK_CLARIFY\r\n  QUALITATIVE --> SYNTHESIZE: LEAF SYNTHESIZE\r\n  MIXED_METHODS --> DECISIONS: RETURN_TO_ROUTER\r\n  MIXED_METHODS --> FOUNDATIONS: RETURN_TO_FOUNDATIONS\r\n  MIXED_METHODS --> SYNTHESIZE: FINISH_DESIGN\r\n  MIXED_METHODS --> CLARIFY: LEAF ASK_CLARIFY\r\n  MIXED_METHODS --> SYNTHESIZE: LEAF SYNTHESIZE\r\n\r\n  SYNTHESIZE --> DONE: DELIVERED\r\n  SYNTHESIZE --> CLARIFY: REFINE\r\n  SYNTHESIZE --> DECISIONS: CONTINUE_DESIGN\r\n  ERROR --> [*]\r\n  BYPASS_DETECTED --> [*]\r\n  DONE --> [*]",
    "instructionBytes": {
      "skillDocBytes": 2074,
      "stateBytes": [
        764,
        911,
        1689,
        1149,
        1142,
        1169,
        1044,
        1081,
        606,
        935,
        912,
        896,
        674,
        959,
        453,
        774,
        752,
        603,
        781,
        763,
        796,
        425,
        858,
        851,
        483,
        836,
        709,
        754,
        589,
        1084
      ]
    }
  },
  {
    "slug": "resume-manager",
    "name": "Resume Manager",
    "version": "2.4.0",
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
      "profile_home",
      "active_profile_id",
      "profiles_dir",
      "master_profile_path",
      "company_name",
      "target_title",
      "role_track",
      "role_fit",
      "role_fit_confidence",
      "role_fit_reasons",
      "role_fit_gaps",
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
      "profile_home": "~/.resume-manager",
      "active_profile_id": "senior_technical",
      "profiles_dir": null,
      "master_profile_path": null,
      "company_name": null,
      "target_title": null,
      "role_track": "senior_technical",
      "role_fit": null,
      "role_fit_confidence": null,
      "role_fit_reasons": [],
      "role_fit_gaps": [],
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
    "stateCount": 21,
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
          "find_by_name",
          "ask_question",
          "run_command"
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
          "view_file",
          "ask_question"
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
          "find_by_name",
          "ask_question",
          "run_command"
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
            "target": "PERSIST_PROFILE",
            "judgment": {
              "type": "predicate",
              "criterion": "Is the achievement bullet verb-first Google XYZ, opening with a strong verb other than Accomplished, with a quantified measurement [Y] and a specific method [Z]?",
              "minConfidence": 0.85,
              "fallbackTarget": "RECORD_ACCOMPLISHMENT"
            }
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
        ],
        "model": {
          "tier": "balanced"
        }
      },
      {
        "name": "PROFILE_SELECTION",
        "description": "Match JD to profile track, judge role fit, and evaluate overqualification & flight-risk indicators",
        "tools": [
          "view_file",
          "ask_question",
          "run_command"
        ],
        "transitions": [
          {
            "signal": "CALIBRATION_REQUIRED",
            "target": "CALIBRATE_FRAMING",
            "guard": "payload.overqualified_risk == true",
            "judgment": {
              "type": "categorical",
              "criterion": "Classify candidate role fit as strong_fit, conditional_fit, or weak_fit based on verified experience against job requirements.",
              "minConfidence": 0.8,
              "fallbackTarget": "FIT_REVIEW"
            }
          },
          {
            "signal": "STANDARD_MATCH",
            "target": "GAP_ANALYSIS",
            "guard": "payload.overqualified_risk != true",
            "judgment": {
              "type": "categorical",
              "criterion": "Classify candidate role fit as strong_fit, conditional_fit, or weak_fit based on verified experience against job requirements.",
              "minConfidence": 0.8,
              "fallbackTarget": "FIT_REVIEW"
            }
          }
        ],
        "model": {
          "tier": "decision"
        }
      },
      {
        "name": "FIT_REVIEW",
        "description": "Human review of weak or low-confidence role fit before application work continues",
        "tools": [
          "view_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "FIT_APPROVED",
            "target": "GAP_ANALYSIS",
            "guard": "event.payload.approved === true"
          },
          {
            "signal": "FIT_REEVALUATE",
            "target": "PROFILE_SELECTION",
            "guard": "event.payload.reevaluate === true"
          },
          {
            "signal": "FIT_REJECTED",
            "target": "SELECT_MODE",
            "guard": "event.payload.rejected === true"
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
        ],
        "model": {
          "tier": "reasoning"
        }
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
          "view_file",
          "ask_question"
        ],
        "transitions": [
          {
            "signal": "MATERIALS_DRAFTED",
            "target": "EXPORTING",
            "guard": "payload.timeline_reconciled == true && payload.unresolved_gap_count == 0",
            "judgment": {
              "type": "predicate",
              "criterion": "Does the drafted application cover letter adhere to professional voice standards and remain free of AI clichés, generic buzzwords, or sycophantic corporate openings?",
              "minConfidence": 0.7,
              "fallbackTarget": "DRAFTING"
            }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n\r\n    INIT --> SELECT_MODE: RUNTIME_READY\r\n    INIT --> SETUP_MCP: SETUP_REQUIRED\r\n\r\n    SETUP_MCP --> SELECT_MODE: SETUP_COMPLETE [exit_code == 0]\r\n    SETUP_MCP --> ERROR: SETUP_FAILED [exit_code != 0]\r\n\r\n    state \"SELECT_MODE\" as SELECT_MODE\r\n    SELECT_MODE --> INGEST_JD: MODE_CUSTOMIZE\r\n    SELECT_MODE --> INSPECT_PROFILE: MODE_MAINTAIN\r\n    SELECT_MODE --> PROFILE_BOOTSTRAP: MODE_BOOTSTRAP\r\n    SELECT_MODE --> MANAGE_PROFILES: MODE_MANAGE_PROFILES\r\n\r\n    %% Bootstrap Track\r\n    state \"PROFILE_BOOTSTRAP\" as PROFILE_BOOTSTRAP\r\n    PROFILE_BOOTSTRAP --> SYNTHESIZE_PROFILES: INTERVIEW_COMPLETE\r\n    PROFILE_BOOTSTRAP --> SELECT_MODE: ABORT_BOOTSTRAP\r\n\r\n    state \"SYNTHESIZE_PROFILES\" as SYNTHESIZE_PROFILES\r\n    SYNTHESIZE_PROFILES --> SUCCESS: PROFILES_SYNTHESIZED\r\n\r\n    %% Maintain Track\r\n    state \"INSPECT_PROFILE\" as INSPECT_PROFILE\r\n    INSPECT_PROFILE --> RECORD_ACCOMPLISHMENT: PROFILE_LOADED\r\n    INSPECT_PROFILE --> PROFILE_BOOTSTRAP: NO_PROFILE_FOUND\r\n\r\n    state \"RECORD_ACCOMPLISHMENT\" as RECORD_ACCOMPLISHMENT\r\n    RECORD_ACCOMPLISHMENT --> PERSIST_PROFILE: RECORDED [XYZ predicate judgment >= 0.85]\r\n    RECORD_ACCOMPLISHMENT --> RECORD_ACCOMPLISHMENT: RECORD_MORE\r\n\r\n    state \"PERSIST_PROFILE\" as PERSIST_PROFILE\r\n    PERSIST_PROFILE --> SUCCESS: PROFILE_SAVED\r\n\r\n    %% Profile Track Management\r\n    state \"MANAGE_PROFILES\" as MANAGE_PROFILES\r\n    MANAGE_PROFILES --> SUCCESS: PROFILES_UPDATED\r\n    MANAGE_PROFILES --> INGEST_JD: SWITCH_TO_CUSTOMIZE\r\n\r\n    %% Customization Track\r\n    state \"INGEST_JD\" as INGEST_JD\r\n    INGEST_JD --> PROFILE_SELECTION: JD_INGESTED [company_name != null]\r\n\r\n    state \"PROFILE_SELECTION\" as PROFILE_SELECTION\r\n    PROFILE_SELECTION --> CALIBRATE_FRAMING: CALIBRATION_REQUIRED [overqualified_risk == true and judgment accepted]\r\n    PROFILE_SELECTION --> GAP_ANALYSIS: STANDARD_MATCH [overqualified_risk != true and judgment accepted]\r\n    PROFILE_SELECTION --> FIT_REVIEW: FIT_REVIEW_REQUIRED [role_fit == weak_fit or role_fit_confidence < 0.8 or judgment rejected]\r\n\r\n    state \"FIT_REVIEW\" as FIT_REVIEW\r\n    FIT_REVIEW --> GAP_ANALYSIS: FIT_APPROVED\r\n    FIT_REVIEW --> PROFILE_SELECTION: FIT_REEVALUATE\r\n    FIT_REVIEW --> SELECT_MODE: FIT_REJECTED\r\n\r\n    state \"CALIBRATE_FRAMING\" as CALIBRATE_FRAMING\r\n    CALIBRATE_FRAMING --> GAP_ANALYSIS: FRAMING_CALIBRATED\r\n\r\n    state \"GAP_ANALYSIS\" as GAP_ANALYSIS\r\n    GAP_ANALYSIS --> COMPANY_ALIGNMENT: ANALYSIS_COMPLETE\r\n\r\n    state \"COMPANY_ALIGNMENT\" as COMPANY_ALIGNMENT\r\n    COMPANY_ALIGNMENT --> DRAFTING: ALIGNMENT_DRAFTED\r\n\r\n    state \"DRAFTING\" as DRAFTING\r\n    DRAFTING --> EXPORTING: MATERIALS_DRAFTED [timeline_reconciled == true, gaps == 0, and voice predicate judgment confidence >= 0.7]\r\n\r\n    state \"EXPORTING\" as EXPORTING\r\n    EXPORTING --> INTERVIEW_PREP: EXPORT_COMPLETE [exit_code == 0]\r\n    EXPORTING --> ERROR: EXPORT_FAILED [exit_code != 0]\r\n\r\n    state \"INTERVIEW_PREP\" as INTERVIEW_PREP\r\n    INTERVIEW_PREP --> EVOLVE_PROFILE: PREP_GENERATED\r\n\r\n    state \"EVOLVE_PROFILE\" as EVOLVE_PROFILE\r\n    EVOLVE_PROFILE --> SUCCESS: EVOLUTION_COMPLETE\r\n    EVOLVE_PROFILE --> SUCCESS: SKIP_EVOLUTION\r\n\r\n    state \"SUCCESS\" as SUCCESS\r\n    state \"ERROR\" as ERROR\r\n\r\n    SUCCESS --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/resume-manager/snapshot.md",
      ".docs/resume-manager/inventory.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 9028,
      "stateBytes": [
        2115,
        1601,
        5445,
        414,
        1407,
        1403,
        814,
        1548,
        1290,
        810,
        1041,
        1961,
        1763,
        1058,
        2507,
        3215,
        1574,
        2183,
        864,
        1175,
        2123
      ]
    }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> COLLECT_STAGED\r\n    COLLECT_STAGED --> SCAN_PIPELINE : STAGED_FILES\\n(guard: staged_files.length > 0)\r\n\r\n    state SCAN_PIPELINE {\r\n        [*] --> SECRETS_SCAN\r\n        SECRETS_SCAN --> CREDENTIALS_SCAN : SECRETS_SCANNED\\n(guard: exit_code === 0)\r\n        CREDENTIALS_SCAN --> CONFIG_SCAN : CREDENTIALS_SCANNED\\n(guard: exit_code === 0)\r\n        CONFIG_SCAN --> REPORT : CONFIG_SCANNED\\n(guard: exit_code === 0, exits SCAN_PIPELINE)\r\n    }\r\n\r\n    state REPORT {\r\n        [*] --> VIOLATION_SUMMARY\r\n        VIOLATION_SUMMARY --> REMEDIATION : SUMMARY_GENERATED\\n(guard: exit_code === 0)\r\n        REMEDIATION --> GATE : REMEDIATION_GENERATED\\n(guard: exit_code === 0, exits REPORT)\r\n    }\r\n\r\n    GATE --> COMPLETED : USER_APPROVED\\n(guard: approved === true)\r\n    GATE --> SCAN_PIPELINE : REQUEST_REMEDIATION\\n(guard: remediation_requested === true)\r\n    GATE --> BLOCKED : USER_REJECTED\\n(guard: rejected === true)\r\n\r\n    COMPLETED --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/security-scan/findings.md",
      ".docs/security-scan/remediation-checklist.md",
      ".docs/security-scan/state.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 2374,
      "stateBytes": [
        972,
        889,
        632,
        973,
        1233,
        1356,
        1254,
        1118,
        1152,
        1350
      ]
    }
  },
  {
    "slug": "systems-diagnosis",
    "name": "Systems Diagnosis",
    "version": "1.0.0",
    "schemaVersion": "2.1.0",
    "category": "General",
    "description": "Diagnose recurring or surprising behavior in a system, explain it through observed patterns and structure, and develop a testable intervention.",
    "tags": [
      "systems-diagnosis",
      "systems",
      "diagnosis"
    ],
    "strictExecution": false,
    "featured": false,
    "initialState": "INIT",
    "contextKeys": [
      "problem_statement",
      "behavior_over_time",
      "system_boundary",
      "time_horizon",
      "desired_outcome",
      "key_actors",
      "system_map",
      "causal_hypotheses",
      "archetype_hypotheses",
      "candidate_interventions",
      "selected_intervention",
      "test_plan",
      "final_diagnosis"
    ],
    "defaultContext": {
      "problem_statement": null,
      "behavior_over_time": null,
      "system_boundary": null,
      "time_horizon": null,
      "desired_outcome": null,
      "key_actors": [],
      "system_map": null,
      "causal_hypotheses": [],
      "archetype_hypotheses": [],
      "candidate_interventions": [],
      "selected_intervention": null,
      "test_plan": null,
      "final_diagnosis": null
    },
    "tools": [],
    "registryRepo": "Reactive-Skills/skills",
    "skillsShInstallCmd": "npx skills add Reactive-Skills/skills --skill systems-diagnosis",
    "installCmd": "npx -y @reactive-skills/axi invoke systems-diagnosis",
    "author": "Reactive Skills Core Team",
    "stateCount": 9,
    "states": [
      {
        "name": "INIT",
        "description": "Verify access to the reactive runtime.",
        "tools": [],
        "transitions": [
          {
            "signal": "RUNTIME_READY",
            "target": "INTAKE"
          },
          {
            "signal": "SETUP_REQUIRED",
            "target": "BYPASS_DETECTED"
          }
        ]
      },
      {
        "name": "INTAKE",
        "description": "Capture the recurring behavior, evidence, and decision need.",
        "tools": [],
        "transitions": [
          {
            "signal": "INTAKE_READY",
            "target": "DEFINE_BOUNDARY",
            "guard": "context.problem_statement != null && context.behavior_over_time != null"
          },
          {
            "signal": "NEED_INTAKE_DETAIL",
            "target": "INTAKE"
          }
        ]
      },
      {
        "name": "DEFINE_BOUNDARY",
        "description": "Confirm the system boundary, time horizon, actors, and desired outcome.",
        "tools": [],
        "transitions": [
          {
            "signal": "BOUNDARY_CONFIRMED",
            "target": "MAP_STRUCTURE",
            "guard": "context.system_boundary != null && context.time_horizon != null && context.desired_outcome != null"
          },
          {
            "signal": "SCOPE_REVISED",
            "target": "DEFINE_BOUNDARY"
          }
        ]
      },
      {
        "name": "MAP_STRUCTURE",
        "description": "Map relevant elements, stocks, flows, information, feedback, delays, and rules.",
        "tools": [],
        "transitions": [
          {
            "signal": "MAP_READY",
            "target": "DIAGNOSE_DYNAMICS",
            "guard": "context.system_map != null"
          },
          {
            "signal": "MAP_NEEDS_EVIDENCE",
            "target": "MAP_STRUCTURE"
          },
          {
            "signal": "TARGET_CHANGED",
            "target": "INTAKE"
          }
        ]
      },
      {
        "name": "DIAGNOSE_DYNAMICS",
        "description": "Explain the observed pattern with testable causal hypotheses.",
        "tools": [],
        "transitions": [
          {
            "signal": "DYNAMICS_EXPLAINED",
            "target": "SELECT_LEVERAGE",
            "guard": "Array.isArray(context.causal_hypotheses) && context.causal_hypotheses.length > 0"
          },
          {
            "signal": "EVIDENCE_CONFLICTS",
            "target": "MAP_STRUCTURE"
          }
        ]
      },
      {
        "name": "SELECT_LEVERAGE",
        "description": "Compare feasible, context-specific intervention points.",
        "tools": [],
        "transitions": [
          {
            "signal": "LEVERAGE_SELECTED",
            "target": "DESIGN_TEST",
            "guard": "context.selected_intervention != null"
          },
          {
            "signal": "NO_VIABLE_OPTION",
            "target": "DIAGNOSE_DYNAMICS"
          }
        ]
      },
      {
        "name": "DESIGN_TEST",
        "description": "Design a bounded test with measures, timing, and stop conditions.",
        "tools": [],
        "transitions": [
          {
            "signal": "TEST_DESIGNED",
            "target": "SYNTHESIZE",
            "guard": "context.test_plan != null"
          },
          {
            "signal": "TEST_UNSAFE",
            "target": "SELECT_LEVERAGE"
          }
        ]
      },
      {
        "name": "SYNTHESIZE",
        "description": "Present the diagnosis, uncertainty, intervention, and test plan.",
        "tools": [],
        "transitions": []
      },
      {
        "name": "BYPASS_DETECTED",
        "description": "Stop when runtime setup fails or the signal contract is bypassed.",
        "tools": [],
        "transitions": []
      }
    ],
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n\r\n    INIT --> INTAKE: RUNTIME_READY\r\n    INIT --> BYPASS_DETECTED: SETUP_REQUIRED\r\n\r\n    INTAKE --> DEFINE_BOUNDARY: INTAKE_READY [problem_statement and behavior_over_time present]\r\n    INTAKE --> INTAKE: NEED_INTAKE_DETAIL\r\n\r\n    DEFINE_BOUNDARY --> MAP_STRUCTURE: BOUNDARY_CONFIRMED [boundary, horizon, and outcome present]\r\n    DEFINE_BOUNDARY --> DEFINE_BOUNDARY: SCOPE_REVISED\r\n\r\n    MAP_STRUCTURE --> DIAGNOSE_DYNAMICS: MAP_READY [system_map present]\r\n    MAP_STRUCTURE --> MAP_STRUCTURE: MAP_NEEDS_EVIDENCE\r\n    MAP_STRUCTURE --> INTAKE: TARGET_CHANGED\r\n\r\n    DIAGNOSE_DYNAMICS --> SELECT_LEVERAGE: DYNAMICS_EXPLAINED [causal_hypotheses populated]\r\n    DIAGNOSE_DYNAMICS --> MAP_STRUCTURE: EVIDENCE_CONFLICTS\r\n\r\n    SELECT_LEVERAGE --> DESIGN_TEST: LEVERAGE_SELECTED [selected_intervention present]\r\n    SELECT_LEVERAGE --> DIAGNOSE_DYNAMICS: NO_VIABLE_OPTION\r\n\r\n    DESIGN_TEST --> SYNTHESIZE: TEST_DESIGNED [test_plan present]\r\n    DESIGN_TEST --> SELECT_LEVERAGE: TEST_UNSAFE\r\n\r\n    SYNTHESIZE --> [*]\r\n    BYPASS_DETECTED --> [*]",
    "instructionBytes": {
      "skillDocBytes": 1597,
      "stateBytes": [
        711,
        844,
        790,
        936,
        634,
        769,
        841,
        924,
        684
      ]
    }
  },
  {
    "slug": "tdd-refactor",
    "name": "TDD Refactor",
    "version": "2.0.4",
    "schemaVersion": "2.1.0",
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INIT\r\n\r\n    %% Bootloader\r\n    INIT --> RED_SPEC: RUNTIME_READY\r\n    INIT --> SETUP_MCP: SETUP_REQUIRED\r\n\r\n    SETUP_MCP --> RED_SPEC: SETUP_COMPLETE [exit_code == 0]\r\n    SETUP_MCP --> ERROR: SETUP_FAILED [exit_code != 0]\r\n\r\n    %% TDD Micro-cycle\r\n    RED_SPEC --> GREEN_CODE: TEST_RAN [exit_code != 0]\r\n    GREEN_CODE --> REFACTOR: TEST_RAN [exit_code === 0]\r\n\r\n    %% Composite state: REFACTOR with nested substates\r\n    state REFACTOR {\r\n        [*] --> CLEAN_CODE\r\n        CLEAN_CODE --> PERF_AUDIT: CLEANING_DONE\r\n        PERF_AUDIT --> AUDIT_VERIFY: AUDIT_PASSED\r\n    }\r\n\r\n    %% External transitions from composite REFACTOR and substates\r\n    REFACTOR --> RED_SPEC: GLOBAL_ABORT\r\n    REFACTOR --> GREEN_CODE: TEST_RAN [exit_code != 0]\r\n    AUDIT_VERIFY --> COMPLETED: ALL_CHECKS_PASSED [exit_code === 0]\r\n    AUDIT_VERIFY --> GREEN_CODE: REGRESSION_DETECTED\r\n\r\n    %% Terminal states\r\n    COMPLETED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/tdd-refactor-summary.md",
      ".docs/state-snapshot.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 929,
      "stateBytes": [
        301,
        404,
        257,
        574,
        681,
        431,
        580,
        553
      ]
    }
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
    "mermaidChart": "stateDiagram-v2\r\n    [*] --> INTAKE\r\n    INTAKE --> CONFIGURE: INTAKE_READY (valid intake)\r\n    INTAKE --> ERROR: INTAKE_INVALID (invalid intake)\r\n    CONFIGURE --> BASELINE: CONFIGURATION_READY (exit_code == 0)\r\n    CONFIGURE --> ERROR: CONFIGURATION_FAILED (invalid configuration)\r\n    BASELINE --> MEASURE: BASELINE_PASSED (exit_code == 0)\r\n    BASELINE --> ERROR: BASELINE_FAILED (exit_code != 0)\r\n    MEASURE --> ANALYZE: COVERAGE_MEASURED (report and metrics present)\r\n    MEASURE --> ERROR: MEASUREMENT_FAILED (report or metrics missing)\r\n    ANALYZE --> GATE: GAPS_ANALYZED (metrics and gaps present)\r\n    ANALYZE --> ERROR: ANALYSIS_FAILED (metrics or gaps missing)\r\n    GATE --> SUCCESS: USER_APPROVED (approved == true)\r\n    GATE --> MEASURE: USER_REQUEST_REMEDIATION (remediation_requested == true)\r\n    GATE --> BLOCKED: USER_REJECTED (rejected == true)\r\n    SUCCESS --> [*]\r\n    BLOCKED --> [*]\r\n    ERROR --> [*]",
    "deliverables": [
      ".docs/test-coverage-gate/coverage-report.md",
      ".docs/test-coverage-gate/state.json"
    ],
    "instructionBytes": {
      "skillDocBytes": 2029,
      "stateBytes": [
        627,
        550,
        435,
        570,
        455,
        608,
        744,
        579,
        397
      ]
    }
  }
];
