import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav', '.wasm': 'application/wasm' };
const port = Number(process.env.PORT || 5173);
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const modelRequest=name.startsWith('/models/');
    const selectedRoot=modelRequest?path.join(root,'..','models'):root;
    const relative=modelRequest?name.slice(7):(name==='/'?'/index.html':name);
    const target = path.resolve(selectedRoot, '.' + relative);
    if (target !== selectedRoot && !target.startsWith(selectedRoot + path.sep)) throw new Error('Invalid path');
    const info=await stat(target);if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length':info.size, 'Cache-Control': modelRequest?'public, max-age=31536000, immutable':'no-cache' });
    if(req.method==='HEAD')res.end();else createReadStream(target).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => {
  if (['EACCES', 'EADDRINUSE'].includes(error.code) && !server.listening) server.listen(0, '127.0.0.1');
  else { console.error(error.message); process.exitCode = 1; }
});
server.on('listening', () => console.log(`Local: http://localhost:${server.address().port}`));
server.listen(port, '127.0.0.1');
