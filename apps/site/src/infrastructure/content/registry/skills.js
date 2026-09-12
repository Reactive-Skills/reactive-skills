/** @type {import('@/contracts/types').RegistrySkillDetail[]} */
// Generated automatically by scripts/sync-registry.js from Reactive-Skills/skills
export const registrySkills = [
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
  }
];
