import { overview } from './overview';
import { quickstart } from './quickstart';
import { authoring } from './authoring';
import { conceptsDoc } from './conceptsDoc';
import { mcp } from './mcp';
import { axi } from './axi';
import { troubleshooting } from './troubleshooting';
import { changelog } from './changelog';

/** @type {Record<string, import('@/contracts/types').DocPage>} */
export const docPages = {
  overview,
  quickstart,
  authoring,
  concepts: conceptsDoc,
  axi,
  mcp,
  troubleshooting,
  changelog,
};

/** @type {import('@/contracts/types').DocPage[]} */
export const docPageList = [overview, quickstart, authoring, conceptsDoc, axi, mcp, troubleshooting, changelog];

