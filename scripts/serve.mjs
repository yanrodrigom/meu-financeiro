// Servidor estático simples que imita o GitHub Pages em /meu-financeiro/ (para testes).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const base = process.env.BASE || '/meu-financeiro/';
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === base.slice(0, -1)) { res.writeHead(302, { Location: base }); return res.end(); }
  if (!url.pathname.startsWith(base)) { res.writeHead(404); return res.end('not found'); }
  let p = normalize(decodeURIComponent(url.pathname.slice(base.length)));
  if (p === '.' || p === '' || p.endsWith('/')) p = join(p, 'index.html');
  const file = join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`http://localhost:${port}${base}`));
