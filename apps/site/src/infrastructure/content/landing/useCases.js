export const landingUseCases = [
  {
    slug: 'tdd-refactor',
    job: 'Refactoring',
    outcome: 'Red, green, and refactor run as separate states, and reported test exit codes gate each phase.',
  },
  {
    slug: 'pr-triage',
    job: 'Code review',
    outcome: 'Collects PR metadata, classifies risk and ownership, checks readiness, then stops for a human decision.',
  },
  {
    slug: 'release-notes',
    job: 'Releases',
    outcome: 'Scopes changes, classifies entries, drafts notes, validates formatting, and waits for approval.',
  },
  {
    slug: 'security-scan',
    job: 'Security',
    outcome: 'Scans staged changes for secrets and credentials, then hands back a remediation checklist.',
  },
];
