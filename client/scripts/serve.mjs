// Serves the built site (out/) the way the production host does: gzip/brotli compression,
// long-lived caching for fingerprinted files, and no caching for HTML. Used for local
// testing and Lighthouse runs:  node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createBrotliCompress, createGzip } from 'node:zlib';

const ROOT = normalize(new URL('../out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PORT = Number(process.argv[2]) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg']);

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  let file = normalize(join(ROOT, clean));
  if (!file.startsWith(ROOT)) return null; // no ../ escapes
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  return existsSync(file) ? file : null;
}

createServer((req, res) => {
  const file = resolve(req.url) ?? join(ROOT, '404.html');
  const ext = extname(file);
  const status = file.endsWith('404.html') && !req.url.includes('404') ? 404 : 200;
  // Files under /_next/static have a content hash in their name, so they can be cached for a year.
  const cache = req.url.startsWith('/_next/static/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
  const headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': cache, Vary: 'Accept-Encoding' };

  const accept = String(req.headers['accept-encoding'] ?? '');
  let stream = createReadStream(file);
  if (COMPRESSIBLE.has(ext) && accept.includes('br')) {
    headers['Content-Encoding'] = 'br';
    stream = stream.pipe(createBrotliCompress());
  } else if (COMPRESSIBLE.has(ext) && accept.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    stream = stream.pipe(createGzip());
  }
  res.writeHead(status, headers);
  stream.pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Serving out/ on http://localhost:${PORT}`));
