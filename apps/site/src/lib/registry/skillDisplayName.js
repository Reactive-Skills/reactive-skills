const ACRONYMS = {
  api: 'API',
  axi: 'AXI',
  cd: 'CD',
  ci: 'CI',
  jsm: 'JSM',
  mcp: 'MCP',
  pr: 'PR',
  sdlc: 'SDLC',
  tdd: 'TDD',
  ui: 'UI',
  ux: 'UX',
};

const OVERRIDES = {
  'ci-cd-automation': 'CI/CD Automation',
  'pep8-review': 'PEP 8 Review',
};

export function skillDisplayName(slug) {
  if (OVERRIDES[slug]) return OVERRIDES[slug];
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => ACRONYMS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
