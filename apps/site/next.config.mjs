import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isGithubPages = process.env.GITHUB_PAGES === 'true' || process.env.CI === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isGithubPages ? '/reactive-skills' : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
};

export default nextConfig;
