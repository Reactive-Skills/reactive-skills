import { overview } from './overview';
import { quickstart } from './quickstart';
import { conceptsDoc } from './conceptsDoc';
import { mcp } from './mcp';
import { axi } from './axi';
import { troubleshooting } from './troubleshooting';
import { changelog } from './changelog';

/** @type {Record<string, import('@/contracts/types').DocPage>} */
export const docPages = {
  overview,
  quickstart,
  concepts: conceptsDoc,
  mcp,
  axi,
  troubleshooting,
  changelog,
};

/** @type {import('@/contracts/types').DocPage[]} */
export const docPageList = [overview, quickstart, conceptsDoc, mcp, axi, troubleshooting, changelog];
