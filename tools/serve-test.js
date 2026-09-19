/* Starts the real dev server and makes real requests at it, including
   path-traversal attempts. Tests the shipped code, not a paraphrase of it.
   Run: node tools/serve-test.js */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 4199;
const root = path.join(__dirname, '..');
const server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe']
});

// A file that exists OUTSIDE the served root — the thing traversal would steal.
const secretDir = path.resolve(root, '..');
const secretName = '__traversal_canary.txt';
const secretPath = path.join(secretDir, secretName);
fs.writeFileSync(secretPath, 'CANARY-SHOULD-NEVER-BE-SERVED');

function req(rawPath) {
  return new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: rawPath, method: 'GET' }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    r.on('error', e => resolve({ status: 0, body: String(e.message) }));
    r.end();
  });
}

const shouldServe = ['/', '/index.html', '/css/style.css', '/js/util.js', '/assets/logo.png'];
const shouldBlock = [
  '/../' + secretName,
  '/../../' + secretName,
  '/%2e%2e/' + secretName,
  '/%2e%2e%2f%2e%2e%2f' + secretName,
  '/js/../../' + secretName,
  '/..%5c' + secretName,
  '/....//' + secretName,
  '//' + secretName,
  '/js/%2e%2e%2f%2e%2e%2f' + secretName
];

(async () => {
  await new Promise(r => setTimeout(r, 700));
  let pass = 0, fail = 0;

  console.log('--- must be served ---');
  for (const p of shouldServe) {
    const { status } = await req(p);
    const ok = status === 200;
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${status}  ${p}`);
  }

  console.log('\n--- must NOT escape the root ---');
  for (const p of shouldBlock) {
    const { status, body } = await req(p);
    const leaked = body.includes('CANARY');
    const ok = !leaked;
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${status}  ${p}${leaked ? '   <-- LEAKED THE CANARY' : ''}`);
  }

  fs.unlinkSync(secretPath);
  server.kill();
  console.log(`\n${fail ? 'FAILED' : 'ALL PASS'} — ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
