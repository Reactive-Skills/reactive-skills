import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandBlock } from '@/components/common/CommandBlock';

const COMMAND = 'npx skills add Reactive-Skills/skills --skill skill-manager';

describe('CommandBlock wrap', () => {
  const markup = renderToStaticMarkup(createElement(CommandBlock, { command: COMMAND, wrap: true }));

  it('renders each argument as its own wrapping span that rebuilds the command', () => {
    const parts = [...markup.matchAll(/<span class="inline-block max-w-full \[overflow-wrap:anywhere\]">([^<]*)<\/span>/g)].map((match) => match[1]);
    expect(parts).toEqual(COMMAND.split(' '));
  });
});
