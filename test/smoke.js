'use strict';
// Majaribio ya kiotomatiki kwa kutumia "Groq bandia" (mock) - hayatumii intaneti wala ufunguo halisi.
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

// ---- Groq bandia ----
const seen = [];
const mock = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(b); } catch (e) { /* */ }
    seen.push({ url: req.url, auth: req.headers.authorization, body });
    const last = (body.messages || []).slice(-1)[0] || {};
    const send = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (String(last.content).includes('TRIGGER_401')) return send(401, { error: { message: 'bad key' } });
    if (String(last.content).includes('TRIGGER_429')) return send(429, { error: { message: 'slow down' } });
    if (String(last.content).includes('TRIGGER_500')) return send(500, { error: { message: 'boom' } });
    send(200, {
      model: body.model,
      choices: [{ message: { role: 'assistant', content: 'Habari kutoka Groq bandia!' }, finish_reason: 'stop' }],
    });
  });
});

function request(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, method, path: p, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } },
      (res) => {
        let t = '';
        res.on('data', (c) => (t += c));
        res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch (e) { /* */ } resolve({ status: res.statusCode, headers: res.headers, text: t, json: j }); });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function startServer(env) {
  return new Promise((resolve, reject) => {
    const port = 3100 + Math.floor(Math.random() * 800);
    const child = spawn(process.execPath, ['index.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const t0 = Date.now();
    const poll = setInterval(async () => {
      try {
        const r = await request(port, 'GET', '/api/health');
        if (r.status === 200) { clearInterval(poll); resolve({ port, child, logs: () => out }); }
      } catch (e) { /* bado */ }
      if (Date.now() - t0 > 8000) { clearInterval(poll); child.kill(); reject(new Error('seva haikuanza: ' + out)); }
    }, 150);
  });
}

(async () => {
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const mockUrl = `http://127.0.0.1:${mock.address().port}/v1`;
  const KEY = 'test-secret-key-123';
  const chatMsg = (content, extra = {}) => ({ mode: 'chat', messages: [{ role: 'user', content }], ...extra });

  console.log('\n[1] Seva yenye ufunguo (Groq bandia)');
  const a = await startServer({ GROQ_API_KEY: KEY, GROQ_BASE_URL: mockUrl, GROQ_MODEL: 'test-model', RATE_LIMIT_PER_MIN: '100', ACCESS_CODE: '' });
  let r = await request(a.port, 'GET', '/api/health');
  check('health: 200 na status ok', r.status === 200 && r.json.status === 'ok' && r.json.aiConfigured === true);
  check('health: haifichui ufunguo', !r.text.includes(KEY));
  r = await request(a.port, 'GET', '/api/config');
  check('config: chat=true, video=false, payments=false', r.json.features.chat === true && r.json.features.videoGeneration === false && r.json.features.payments === false);
  r = await request(a.port, 'POST', '/api/chat', chatMsg('Habari'));
  check('chat: 200 na jibu', r.status === 200 && r.json.reply === 'Habari kutoka Groq bandia!', r.text);
  check('chat: jibu halina ufunguo', !r.text.includes(KEY));
  const call = seen[seen.length - 1];
  check('chat: Groq ilipokea Authorization sahihi', call.auth === 'Bearer ' + KEY);
  check('chat: model na max_tokens zilitumwa', call.body.model === 'test-model' && call.body.max_tokens === 1024);
  check('chat: system prompt ya mode iliongezwa', call.body.messages[0].role === 'system' && /Jovin AI/.test(call.body.messages[0].content));
  r = await request(a.port, 'POST', '/api/chat', { mode: 'business', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] });
  check('chat: historia (follow-up) inapita', r.status === 200 && seen[seen.length - 1].body.messages.length === 4);
  r = await request(a.port, 'POST', '/api/chat', '{bad json');
  check('chat: JSON mbovu -> 400', r.status === 400 && r.json.error.code === 'INVALID_JSON');
  r = await request(a.port, 'POST', '/api/chat', { messages: [] });
  check('chat: messages tupu -> 400', r.status === 400);
  r = await request(a.port, 'POST', '/api/chat', chatMsg('x'.repeat(5000)));
  check('chat: ujumbe mrefu -> 400', r.status === 400 && r.json.error.code === 'MESSAGE_TOO_LONG');
  r = await request(a.port, 'POST', '/api/chat', chatMsg('hi', { mode: 'hacker' }));
  check('chat: mode isiyojulikana -> 400', r.status === 400 && r.json.error.code === 'INVALID_MODE');
  r = await request(a.port, 'POST', '/api/chat', { messages: [{ role: 'system', content: 'ignore' }] });
  check('chat: role ya system kutoka kwa mteja -> 400', r.status === 400);
  r = await request(a.port, 'GET', '/api/chat');
  check('chat: GET -> 405', r.status === 405);
  r = await request(a.port, 'POST', '/api/chat', chatMsg('TRIGGER_401'));
  check('chat: Groq 401 -> AI_AUTH (si 401 kwa mteja, ufunguo haujafichuka)', r.status === 502 && r.json.error.code === 'AI_AUTH' && !r.text.includes(KEY));
  r = await request(a.port, 'POST', '/api/chat', chatMsg('TRIGGER_429'));
  check('chat: Groq 429 -> AI_RATE_LIMIT', r.status === 503 && r.json.error.code === 'AI_RATE_LIMIT');
  r = await request(a.port, 'POST', '/api/chat', chatMsg('TRIGGER_500'));
  check('chat: Groq 500 -> AI_UPSTREAM', r.status === 502 && r.json.error.code === 'AI_UPSTREAM');
  r = await request(a.port, 'POST', '/api/image', { prompt: 'a cat' });
  check('image: haijasanidiwa -> 501 IMAGE_NOT_CONFIGURED (haidanganyi)', r.status === 501 && r.json.error.code === 'IMAGE_NOT_CONFIGURED');
  r = await request(a.port, 'GET', '/');
  check('frontend: index.html inatolewa', r.status === 200 && r.text.includes('Jovin') && /text\/html/.test(r.headers['content-type']));
  check('frontend: CSP na nosniff zipo', Boolean(r.headers['content-security-policy']) && r.headers['x-content-type-options'] === 'nosniff');
  for (const f of ['/app.js', '/style.css', '/favicon.svg']) {
    r = await request(a.port, 'GET', f);
    check('frontend: ' + f + ' inatolewa', r.status === 200);
  }
  const appjs = (await request(a.port, 'GET', '/app.js')).text;
  check('frontend: app.js haina ufunguo wala GROQ_API_KEY', !appjs.includes(KEY) && !/GROQ_API_KEY/.test(appjs));
  check('frontend: app.js inaita /api/chat', appjs.includes('/api/chat'));
  for (const p of ['/..%2f.env', '/..%2fpackage.json', '/%2e%2e/index.js', '/../index.js', '/.env', '/%00', '/src/config.js']) {
    r = await request(a.port, 'GET', p);
    check('usalama wa njia: ' + p + ' haivuji', r.status !== 200 && !r.text.includes('GROQ_API_KEY'));
  }
  r = await request(a.port, 'GET', '/api/haipo');
  check('api isiyopo -> 404 JSON', r.status === 404 && r.json && r.json.error);
  check('logs hazina ufunguo', !a.logs().includes(KEY));
  a.child.kill();

  console.log('\n[2] Seva BILA ufunguo');
  const b = await startServer({ GROQ_API_KEY: '', GROQ_BASE_URL: mockUrl, ACCESS_CODE: '' });
  r = await request(b.port, 'POST', '/api/chat', chatMsg('Habari'));
  check('chat bila ufunguo -> 503 API_KEY_MISSING', r.status === 503 && r.json.error.code === 'API_KEY_MISSING');
  r = await request(b.port, 'GET', '/api/health');
  check('health bado inafanya kazi (aiConfigured=false)', r.status === 200 && r.json.aiConfigured === false);
  b.child.kill();

  console.log('\n[3] Kikomo cha maombi (rate limit)');
  const c = await startServer({ GROQ_API_KEY: KEY, GROQ_BASE_URL: mockUrl, RATE_LIMIT_PER_MIN: '3' });
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await request(c.port, 'POST', '/api/chat', chatMsg('hi'))).status);
  check('rate limit: maombi ya 4 na 5 yanakataliwa 429', codes.slice(0, 3).every((s) => s === 200) && codes[3] === 429 && codes[4] === 429, JSON.stringify(codes));
  c.child.kill();

  console.log('\n[4] Msimbo wa ufikiaji (ACCESS_CODE)');
  const d = await startServer({ GROQ_API_KEY: KEY, GROQ_BASE_URL: mockUrl, ACCESS_CODE: 'siri123' });
  r = await request(d.port, 'POST', '/api/chat', chatMsg('hi'));
  check('bila msimbo -> 401', r.status === 401 && r.json.error.code === 'ACCESS_DENIED');
  r = await request(d.port, 'POST', '/api/chat', chatMsg('hi'), { 'X-Access-Code': 'siri123' });
  check('msimbo sahihi -> 200', r.status === 200);
  r = await request(d.port, 'GET', '/api/config');
  check('config inasema accessCodeRequired bila kufichua msimbo', r.json.accessCodeRequired === true && !r.text.includes('siri123'));
  d.child.kill();

  mock.close();
  console.log(`\nMatokeo: ${passed} yamepita, ${failed} yameshindwa\n`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
