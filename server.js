// Minimal static file server for Taste Network (Railway / any Node host).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    let body = data;
    // Inject Supabase config into the page from environment variables.
    // The anon key is public by design (it ships in client apps); it stays
    // out of git and is supplied via Railway env vars.
    if (file.endsWith('index.html')) {
      const env = {
        url: process.env.SUPABASE_URL || '',
        key: process.env.SUPABASE_ANON_KEY || ''
      };
      body = Buffer.from(data.toString().replace(
        '<!--TN_ENV-->',
        '<script>window.TN_ENV=' + JSON.stringify(env) + '</script>'
      ));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  });
}).listen(PORT, () => console.log('Taste Network listening on :' + PORT));
