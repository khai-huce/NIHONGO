// Vercel project root: repository root (npm workspaces).
const apiOrigin = process.env.NIHONGO_API_ORIGIN;
if (!apiOrigin) {
  throw new Error('Set NIHONGO_API_ORIGIN to the public HTTPS origin of the NIHONGO API.');
}
const origin = new URL(apiOrigin);
if (origin.protocol !== 'https:' || origin.href !== origin.origin + '/') {
  throw new Error('NIHONGO_API_ORIGIN must be an HTTPS origin without a path or credentials.');
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci --include=dev --workspace @nihongo/web --workspace @nihongo/client --workspace @nihongo/shared --include-workspace-root',
  buildCommand: 'npm run build:web',
  outputDirectory: 'apps/web/dist',
  rewrites: [
    { source: '/api/:path*', destination: origin.origin + '/api/:path*' },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
