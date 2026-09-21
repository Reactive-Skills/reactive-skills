import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

/**
 * Parses markdown body into structured sections and blocks compatible with DocSections.
 * @param {string} body
 * @returns {import('@/contracts/types').DocSection[]}
 */
export function parseMarkdownToSections(body) {
  if (!body) return [];

  // Split by H2 headers (## Heading)
  const h2Regex = /^##\s+(.+)$/gm;
  const sections = [];
  const matches = [...body.matchAll(h2Regex)];

  if (matches.length === 0) {
    return [
      {
        id: 'main',
        heading: '',
        blocks: parseBlocks(body),
      },
    ];
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const heading = match[1].trim();
    const id = heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const startIndex = match.index + match[0].length;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : body.length;
    const sectionBody = body.slice(startIndex, endIndex).trim();

    sections.push({
      id,
      heading,
      blocks: parseBlocks(sectionBody),
    });
  }

  return sections;
}

/**
 * Parses a section chunk into typed blocks (text, code, list, callout).
 * @param {string} text
 * @returns {import('@/contracts/types').DocBlock[]}
 */
function parseBlocks(text) {
  const blocks = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // 1. Code block: ```language
    if (line.trim().startsWith('```')) {
      const language = line.trim().replace(/^```/, '').trim() || 'text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: 'code',
        example: {
          language,
          command: codeLines.join('\n'),
        },
      });
      continue;
    }

    // 2. Blockquote / Callout: > ...
    if (line.startsWith('>')) {
      const calloutLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        calloutLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const fullCallout = calloutLines.join('\n');
      const titleMatch = fullCallout.match(/^\*\*(.*?)\*\*\s*\n?([\s\S]*)$/);
      blocks.push({
        type: 'callout',
        variant: 'info',
        title: titleMatch ? titleMatch[1] : undefined,
        text: titleMatch ? titleMatch[2].trim() : fullCallout.trim(),
      });
      continue;
    }

    // 3. Bulleted or numbered list: - item or 1. item
    if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
      const items = [];
      while (i < lines.length && (lines[i].match(/^[-*]\s+/) || lines[i].match(/^\d+\.\s+/))) {
        items.push(lines[i].replace(/^([-*]|\d+\.)\s+/, '').trim());
        i++;
      }
      blocks.push({
        type: 'list',
        items,
      });
      continue;
    }

    // 4. Regular paragraph
    const paragraphLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].startsWith('>') &&
      !lines[i].match(/^[-*]\s+/) &&
      !lines[i].match(/^\d+\.\s+/)
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'text',
        text: paragraphLines.join(' '),
      });
    }
  }

  return blocks;
}

/**
 * Loads and parses all markdown blog posts from content/blog.
 * @returns {import('@/contracts/types').BlogPost[]}
 */
export function loadMarkdownBlogPosts() {
  const candidateDirs = [
    path.resolve(process.cwd(), '../../content/blog'),
    path.resolve(process.cwd(), 'content/blog'),
    path.resolve(process.cwd(), '../content/blog'),
  ];

  let blogDir = candidateDirs.find((d) => fs.existsSync(d));

  if (!blogDir) {
    return [];
  }

  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const slugFallback = file.replace(/\.md$/, '');

    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let frontmatter = {};
    let body = content;

    if (match) {
      try {
        frontmatter = yaml.load(match[1]) || {};
        body = match[2].trim();
      } catch (err) {
        console.warn(`[MarkdownLoader] Error parsing frontmatter for ${file}:`, err);
      }
    }

    const sections = parseMarkdownToSections(body);

    posts.push({
      slug: frontmatter.slug || slugFallback,
      title: frontmatter.title || 'Untitled',
      subtitle: frontmatter.subtitle || '',
      summary: frontmatter.summary || '',
      publishedAt: frontmatter.publishedAt || new Date().toISOString().slice(0, 10),
      readTime: frontmatter.readTime || '5 min read',
      category: frontmatter.category || 'Architecture',
      tags: frontmatter.tags || [],
      featured: Boolean(frontmatter.featured),
      author: frontmatter.author || {
        name: 'Reactive Skills Core Team',
        role: 'Runtime Architecture',
        handle: '@reactiveskills',
        avatar: '⚡',
      },
      series: frontmatter.series || null,
      sections,
    });
  }

  // Sort newest first
  return posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}
