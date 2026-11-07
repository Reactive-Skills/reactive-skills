import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isRootSite = process.env.NEXT_PUBLIC_ROOT_SITE === 'true';
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath =
  isRootSite || configuredBasePath === '/'
    ? ''
    : (configuredBasePath ?? '');

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
