/* Tiny static server for local testing. Run: node tools/serve.js [port]
   The game itself needs no server — this is only for convenience. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  // Containment: path.join (never path.resolve) so a leading separator
  // cannot re-root the path at the drive, then require the result to sit
  // strictly inside root. Comparing against `root + sep` matters — a bare
  // startsWith(root) would also accept a sibling like "<root>-backup".
  const file = path.join(root, path.normalize(rel).replace(/^[\\/]+/, ''));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}).listen(port, () => console.log('CHAINBREAK dev server on http://localhost:' + port));
