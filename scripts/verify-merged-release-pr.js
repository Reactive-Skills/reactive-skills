#!/usr/bin/env node

import fs from 'node:fs';

const targetSha = process.argv[2];
if (!/^[0-9a-f]{40}$/i.test(targetSha ?? '')) {
  console.error('Refusing publication: expected the full tagged commit SHA.');
  process.exit(1);
}

let pages;
try {
  pages = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (error) {
  console.error(`Refusing publication: unable to read pull request data (${error.message}).`);
  process.exit(1);
}

if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) {
  console.error('Refusing publication: pull request response has an unexpected shape.');
  process.exit(1);
}

const matchingPullRequest = pages.flat().find((pullRequest) =>
  pullRequest
  && pullRequest.merged_at
  && pullRequest.base?.ref === 'main'
  && pullRequest.merge_commit_sha?.toLowerCase() === targetSha.toLowerCase(),
);

if (!matchingPullRequest) {
  console.error('Refusing publication: tag target is not the merge commit of a merged pull request into main.');
  process.exit(1);
}

console.log(`Verified merged pull request #${matchingPullRequest.number} into main.`);
