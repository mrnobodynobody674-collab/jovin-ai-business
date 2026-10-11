'use strict';
// Jovin AI - seva kuu. Hakuna dependencies za nje (Node built-in pekee).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./src/config');
const { AppError, sendJson, readJsonBody } = require('./src/http');
const { createLimiter } = require('./src/ratelimit');
const { MODES } = require('./src/modes');
const { validateChat, validateImage } = require('./src/validate');
const groq = require('./src/groq');
const image = require('./src/image');
const plans = require('./src/plans');

const startedAt = Date.now();
const chatLimiter = createLimiter({ max: config.rateLimitPerMin, windowMs: 60 * 1000 });
const imageLimiter = createLimiter({ max: Math.max(1, Math.floor(config.rateLimitPerMin / 4)), windowMs: 60 * 1000 });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; " +
      "connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
}

function clientIp(req) {
  if (config.trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
  }
  return req.socket.remoteAddress || 'unknown';
}

function enforceLimit(limiter, req) {
  const r = limiter.check(clientIp(req));
  if (!r.allowed) {
    throw new AppError(429, 'RATE_LIMITED', `Maombi mengi mno. Jaribu tena baada ya sekunde ${r.retryAfter}.`, {
      retryAfter: r.retryAfter,
    });
  }
}

function checkAccess(req) {
  if (!config.accessCode) return;
  const given = Buffer.from(String(req.headers['x-access-code'] || ''));
  const expected = Buffer.from(config.accessCode);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) throw new AppError(401, 'ACCESS_DENIED', 'Msimbo wa ufikiaji si sahihi.');
}

function requireMethod(req, method) {
  if (req.method !== method) {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', `Njia hii inatumia ${method} tu.`);
  }
}

// ---------- API ----------
async function handleChat(req, res) {
  requireMethod(req, 'POST');
  enforceLimit(chatLimiter, req);
  checkAccess(req);
  const body = await readJsonBody(req, config.maxBodyBytes);
  const { mode, messages } = validateChat(body);

  if (!config.groqApiKey) {
    throw new AppError(
      503,
      'API_KEY_MISSING',
      'GROQ_API_KEY haijawekwa kwenye seva. Weka ufunguo kwenye faili la .env kisha anzisha seva upya.'
    );
  }
  const quota = plans.checkQuota({ ip: clientIp(req) });
  if (!quota.allowed) throw new AppError(429, 'QUOTA_EXCEEDED', 'Umefikia kikomo cha matumizi.');

  const result = await groq.chat(mode, messages);
  sendJson(res, 200, result);
}

async function handleImage(req, res) {
  requireMethod(req, 'POST');
  enforceLimit(imageLimiter, req);
  checkAccess(req);
  const body = await readJsonBody(req, config.maxBodyBytes);
  const { prompt } = validateImage(body);
  const result = await image.generate(prompt);
  sendJson(res, 200, result);
}

function handleHealth(req, res) {
  requireMethod(req, 'GET');
  sendJson(res, 200, {
    status: 'ok',
    app: 'Jovin AI',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    aiConfigured: Boolean(config.groqApiKey),
  });
}

function handleConfig(req, res) {
  requireMethod(req, 'GET');
  sendJson(res, 200, {
    app: 'Jovin AI',
    modes: Object.keys(MODES),
    maxMessageChars: config.maxMessageChars,
    maxHistoryMessages: config.maxHistoryMessages,
    accessCodeRequired: Boolean(config.accessCode),
    features: {
      chat: Boolean(config.groqApiKey),
      imageGeneration: image.isConfigured(),
      videoGeneration: false,
      accounts: false,
      payments: false,
    },
  });
}

// ---------- Faili tuli (public/) ----------
function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Njia hii inatumia GET tu.');
  }
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    throw new AppError(400, 'BAD_PATH', 'Njia si sahihi.');
  }
  if (rel.includes('\0')) throw new AppError(400, 'BAD_PATH', 'Njia si sahihi.');
  if (rel === '/' || rel === '') rel = '/index.html';

  const full = path.resolve(config.PUBLIC_DIR, '.' + path.posix.normalize('/' + rel));
  if (full !== config.PUBLIC_DIR && !full.startsWith(config.PUBLIC_DIR + path.sep)) {
    throw new AppError(404, 'NOT_FOUND', 'Ukurasa haupatikani.');
  }
  const ext = path.extname(full).toLowerCase();
  if (!MIME[ext]) throw new AppError(404, 'NOT_FOUND', 'Ukurasa haupatikani.');

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ukurasa haupatikani.' } });
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext],
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(full);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

// ---------- Router ----------
async function route(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  switch (pathname) {
    case '/api/health':
      return handleHealth(req, res);
    case '/api/config':
      return handleConfig(req, res);
    case '/api/chat':
      return handleChat(req, res);
    case '/api/image':
      return handleImage(req, res);
    default:
      if (pathname.startsWith('/api/')) throw new AppError(404, 'NOT_FOUND', 'API haipatikani.');
      return serveStatic(req, res, pathname);
  }
}

function handleError(res, err) {
  if (res.headersSent) return res.end();
  if (err instanceof AppError) {
    const headers = err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {};
    return sendJson(res, err.status, { error: { code: err.code, message: err.message } }, headers);
  }
  console.error('Hitilafu isiyotarajiwa:', err && err.message);
  sendJson(res, 500, { error: { code: 'INTERNAL', message: 'Hitilafu ya ndani ya seva.' } });
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    /* tumia '/' */
  }
  res.on('finish', () => {
    // Hatuandiki body, headers wala ufunguo kwenye logs.
    console.log(`${new Date().toISOString()} ${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`);
  });
  setSecurityHeaders(res);
  Promise.resolve()
    .then(() => route(req, res))
    .catch((err) => handleError(res, err));
});

server.requestTimeout = 120 * 1000;
server.headersTimeout = 20 * 1000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} tayari inatumika. Badilisha PORT kwenye .env au simamisha seva ya zamani.`);
  } else {
    console.error('Seva imeshindwa kuanza:', err.message);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log('==============================================');
  console.log(' Jovin AI inafanya kazi');
  console.log(` Fungua kwenye kivinjari: http://localhost:${config.port}`);
  console.log(` Seva inasikiliza: ${config.host}:${config.port}`);
  console.log(` Modeli: ${config.groqModel}`);
  console.log(` Groq API key: ${config.groqApiKey ? 'imewekwa' : 'HAIJAWEKWA (chat haitafanya kazi)'}`);
  console.log(` Picha (API ya nje): ${image.isConfigured() ? 'imewashwa' : 'haijawashwa'}`);
  if (config.host !== '127.0.0.1' && config.host !== 'localhost' && !config.accessCode) {
    console.log(' ONYO: Seva inapatikana nje ya simu yako bila ACCESS_CODE. Weka ACCESS_CODE kwenye .env.');
  }
  console.log(' Simamisha: bonyeza Ctrl+C');
  console.log('==============================================');
});

function shutdown() {
  console.log('\nInazima seva...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
