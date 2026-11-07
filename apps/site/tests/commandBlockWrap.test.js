import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandBlock } from '@/components/common/CommandBlock';

const COMMAND = 'npx skills add Reactive-Skills/skills --skill skill-manager';

describe('CommandBlock wrap', () => {
  const markup = renderToStaticMarkup(createElement(CommandBlock, { command: COMMAND, wrap: true }));

  it('keeps each argument unbroken so lines break only between arguments', () => {
    const parts = [...markup.matchAll(/<span class="whitespace-nowrap">([^<]*)<\/span>/g)].map((match) => match[1]);
    expect(parts).toEqual(COMMAND.split(' '));
  });

  it('does not clip the command to one scrolling line', () => {
    expect(markup).not.toContain('sm:whitespace-nowrap');
  });
});
