/** @type {import('@/contracts/types').DocsNavigation} */
export const navigation = {
  groups: [
    {
      title: 'Introduction',
      links: [{ title: 'Overview', href: '/docs' }],
    },
    {
      title: 'Get started',
      links: [{ title: 'Quickstart', href: '/docs/quickstart' }],
    },
    {
      title: 'Understand',
      links: [{ title: 'Concepts', href: '/docs/concepts' }],
    },
    {
      title: 'Integrate',
      links: [
        { title: 'AXI (Preferred)', href: '/docs/axi' },
        { title: 'MCP', href: '/docs/mcp' },
      ],
    },
    {
      title: 'Reference',
      links: [
        { title: 'Troubleshooting', href: '/docs/troubleshooting' },
        { title: 'Changelog', href: '/docs/changelog' },
      ],
    },
  ],
};
