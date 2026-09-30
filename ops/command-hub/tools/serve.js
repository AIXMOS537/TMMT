/* AIXMOS Command Center - tools/serve.js
 *
 *   node tools/serve.js            -> http://127.0.0.1:8899  (CEO-Dashboard.html)
 *   node tools/serve.js . 9000     -> pick a root and a port
 *
 * The consoles are plain files, but the os/*.js includes are relative, so they
 * need an http origin. This is for local work only: it binds to 127.0.0.1 and
 * serves static files with no directory listing.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PORT = Number(process.argv[3] || 8899);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/CEO-Dashboard.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + rel); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT));
