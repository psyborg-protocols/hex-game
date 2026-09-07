// serve.js
// Dependency-free static server for the game and the editor.
//
//   node tools/serve.js [port]
//
// Serves the repo root so `new_tiles/`, `icons/` and `data/` resolve at the
// same paths the tools and docs already use. Directory listings are emitted as
// plain <a href> links, which is what editor.js's autoDiscoverTiles() parses.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function listing(res, dir, urlPath) {
  const names = fs.readdirSync(dir).sort();
  const links = names.map(n => {
    const isDir = fs.statSync(path.join(dir, n)).isDirectory();
    const href = urlPath.replace(/\/?$/, '/') + n + (isDir ? '/' : '');
    return `<a href="${href}">${n}${isDir ? '/' : ''}</a>`;
  });
  send(res, 200, `<!doctype html><meta charset="utf-8"><pre>${links.join('\n')}</pre>`, TYPES['.html']);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const target = path.join(ROOT, urlPath);

  // Refuse anything that escapes the repo root.
  if (!target.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return send(res, 404, `Not found: ${urlPath}`);
  }

  if (stat.isDirectory()) {
    const index = path.join(target, 'index.html');
    if (fs.existsSync(index)) {
      return send(res, 200, fs.readFileSync(index), TYPES['.html']);
    }
    return listing(res, target, urlPath);
  }

  send(res, 200, fs.readFileSync(target), TYPES[path.extname(target).toLowerCase()]);
}).listen(PORT, () => {
  console.log(`serving ${ROOT} on http://localhost:${PORT}`);
  console.log(`  game   http://localhost:${PORT}/`);
  console.log(`  editor http://localhost:${PORT}/editor.html`);
});
