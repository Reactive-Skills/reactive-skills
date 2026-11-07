import { CodeBlock } from '@/components/common/CodeBlock';
import { Callout } from '@/components/common/Callout';
import { getProseVariant } from '@/lib/docs/proseVariants';

function renderDocText(text) {
  if (typeof text !== 'string') return text;
  const tokenRegex = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    const mdMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdMatch) {
      return (
        <a
          key={i}
          href={mdMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-phino-signal underline decoration-phino-signal/40 underline-offset-2 hover:decoration-phino-signal"
        >
          {mdMatch[1]}
        </a>
      );
    }

    if (part.startsWith('http://') || part.startsWith('https://')) {
      let url = part;
      let trailing = '';
      const punctMatch = url.match(/[.,;:)]+$/);
      if (punctMatch) {
        trailing = punctMatch[0];
        url = url.slice(0, -trailing.length);
      }
      return (
        <span key={i}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-phino-signal underline decoration-phino-signal/40 underline-offset-2 hover:decoration-phino-signal break-all"
          >
            {url}
          </a>
          {trailing}
        </span>
      );
    }

    const codeMatch = part.match(/^`([^`]+)`$/);
    if (codeMatch) {
      return (
        <code key={i} className="rounded bg-phino-surface-raised px-1.5 py-0.5 font-mono text-xs text-phino-text border border-phino-border">
          {codeMatch[1]}
        </code>
      );
    }

    return part;
  });
}

function TextBlock({ text, prose }) {
  return <p className={`my-4 ${prose.text}`}>{renderDocText(text)}</p>;
}

function ListBlock({ items, prose }) {
  return (
    <ul className="my-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className={`flex gap-2.5 ${prose.text}`}>
          <span className={`${prose.bullet} h-1.5 w-1.5 shrink-0 rounded-full bg-phino-signal`} aria-hidden="true" />
          <span>{renderDocText(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function StepsBlock({ steps, prose }) {
  return (
    <ol className="my-5 space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-phino-border bg-phino-surface-raised font-mono text-xs text-phino-text">{i + 1}</span>
          <div>
            <p className={`font-display ${prose.stepTitle} font-semibold text-phino-text`}>{s.title}</p>
            <p className={`mt-0.5 ${prose.stepText}`}>{renderDocText(s.text)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Docs table: mono key column, wrapping prose cells, and a sideways scroll on narrow screens.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(r * c) in table rows and columns
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
function TableBlock({ columns, rows, caption }) {
  return (
    <figure className="my-6">
      <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="border-b border-phino-border-strong pb-2 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-phino-text-subtle">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="align-top">
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? 'border-b border-phino-border py-2.5 pr-4 font-mono text-[12.5px] text-phino-signal-text' : 'border-b border-phino-border py-2.5 pr-4 leading-relaxed text-phino-text-muted'}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption ? <figcaption className="mt-2.5 text-[13px] text-phino-text-subtle">{caption}</figcaption> : null}
    </figure>
  );
}

function Block({ block, prose }) {
  switch (block.type) {
    case 'text':
      return <TextBlock text={block.text} prose={prose} />;
    case 'list':
      return <ListBlock items={block.items} prose={prose} />;
    case 'steps':
      return <StepsBlock steps={block.steps} prose={prose} />;
    case 'code':
      return <CodeBlock example={block.example} />;
    case 'callout':
      return <Callout variant={block.variant} title={block.title} text={renderDocText(block.text)} />;
    case 'table':
      return <TableBlock columns={block.columns} rows={block.rows} caption={block.caption} />;
    default:
      return null;
  }
}

export function DocBlocks({ blocks, variant }) {
  if (!blocks || blocks.length === 0) return null;
  const prose = getProseVariant(variant);
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} prose={prose} />
      ))}
    </>
  );
}

export function DocSections({ sections, variant }) {
  return (
    <div>
      {(sections || []).map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24 pt-8 first:pt-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-phino-text sm:text-2xl">{section.heading}</h2>
          <DocBlocks blocks={section.blocks} variant={variant} />
        </section>
      ))}
    </div>
  );
}

/**
 * "On this page" box: plain in-page anchors, rendered on the server so it works without JavaScript.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in the n page sections
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=2
 */
function OnThisPage({ sections }) {
  return (
    <nav aria-label="On this page" className="mb-10 rounded-lg border border-phino-border bg-phino-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-phino-text-subtle">On this page</p>
      <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="text-sm text-phino-text-muted transition-colors hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
              {section.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * A docs page: category eyebrow, title, summary, "On this page" and the sections, all in the static HTML.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the only client work is the copy buttons in code blocks)
 * - Complexity: O(n) in the n sections and their blocks
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function DocPageView({ page }) {
  const sections = page.sections || [];
  return (
    <article className="min-w-0 max-w-2xl">
      <header className="pb-8">
        {page.category ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-signal-text">{page.category}</p>
        ) : null}
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-phino-text sm:text-[40px] sm:leading-[1.05]">{page.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-phino-text-muted sm:text-[17px]">{renderDocText(page.summary)}</p>
      </header>
      {sections.length > 1 ? <OnThisPage sections={sections} /> : null}
      <DocSections sections={sections} />
    </article>
  );
}
