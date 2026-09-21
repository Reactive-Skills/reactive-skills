import { CodeBlock } from '@/components/common/CodeBlock';
import { Callout } from '@/components/common/Callout';
import { TableOfContents } from './TableOfContents';

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

function TextBlock({ text }) {
  return <p className="my-4 text-[15px] leading-7 text-phino-text-muted">{renderDocText(text)}</p>;
}

function ListBlock({ items }) {
  return (
    <ul className="my-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-7 text-phino-text-muted">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-phino-signal" aria-hidden="true" />
          <span>{renderDocText(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function StepsBlock({ steps }) {
  return (
    <ol className="my-5 space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-phino-border bg-phino-surface-raised font-mono text-xs text-phino-text">{i + 1}</span>
          <div>
            <p className="font-display text-sm font-semibold text-phino-text">{s.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-phino-text-muted">{renderDocText(s.text)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TableBlock({ columns, rows, caption }) {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border border-phino-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap bg-phino-surface-raised px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-phino-text-subtle">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-phino-border">
              {row.map((cell, ci) => (
                <td key={ci} className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-phino-text-muted">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption ? <p className="border-t border-phino-border bg-phino-surface px-3 py-2 text-xs text-phino-text-subtle">{caption}</p> : null}
    </div>
  );
}

function Block({ block }) {
  switch (block.type) {
    case 'text':
      return <TextBlock text={block.text} />;
    case 'list':
      return <ListBlock items={block.items} />;
    case 'steps':
      return <StepsBlock steps={block.steps} />;
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

export function DocBlocks({ blocks }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

export function DocSections({ sections }) {
  return (
    <div>
      {(sections || []).map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24 pt-8 first:pt-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-phino-text sm:text-2xl">{section.heading}</h2>
          <DocBlocks blocks={section.blocks} />
        </section>
      ))}
    </div>
  );
}

export function DocPageView({ page }) {
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_220px] xl:gap-12">
      <article className="min-w-0 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text">{page.category}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-phino-text sm:text-4xl">{page.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-phino-text-muted">{renderDocText(page.summary)}</p>
        <hr className="my-8 border-phino-border" />
        <DocSections sections={page.sections} />
      </article>
      {page.sections && page.sections.length > 1 && (
        <aside className="hidden xl:block">
          <div className="sticky top-24 pt-2">
            <TableOfContents sections={page.sections} />
          </div>
        </aside>
      )}
    </div>
  );
}
