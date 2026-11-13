import { createServer, type Server } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

const fileIn = (root: string, urlPath: string): string | null => {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^[/\\]+/, '');
  const full = join(root, rel);
  if (full !== root && !full.startsWith(root + sep)) return null; // path traversal
  try {
    const st = statSync(full);
    if (st.isFile()) return full;
    if (st.isDirectory()) {
      const idx = join(full, 'index.html');
      return statSync(idx).isFile() ? idx : null;
    }
  } catch {
    /* not found */
  }
  return null;
};

/** Tiny static server over several roots (first match wins; the page itself only from `pageRoot`). Listens on a free port. */
export async function serveStatic(roots: string[], pageRoot?: string): Promise<{ url: string; server: Server; close(): Promise<void> }> {
  const server = createServer((req, res) => {
    try {
      const pathname = new URL(req.url ?? '/', 'http://x').pathname;
      // The runtime page ('/' and '/index.html') only ever comes from pageRoot, so an index.html in an
      // extra assets directory cannot shadow it.
      const isPage = pathname === '/' || pathname === '/index.html';
      for (const root of isPage && pageRoot ? [pageRoot] : roots) {
        const f = fileIn(root, pathname);
        if (f) {
          res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
          createReadStream(f).pipe(res);
          return;
        }
      }
      res.writeHead(404).end('not found');
    } catch {
      res.writeHead(400).end('bad request');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('static server: no address');
  return {
    url: `http://127.0.0.1:${addr.port}`,
    server,
    close: () => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections?.(); }),
  };
}
