'use strict';
// Usanidi: husoma .env (bila package ya nje) na kuweka thamani salama.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Imeshindwa kusoma .env:', e.code);
    return;
  }
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      val.length >= 2 &&
      ((val[0] === '"' && val[val.length - 1] === '"') ||
        (val[0] === "'" && val[val.length - 1] === "'"))
    ) {
      val = val.slice(1, -1);
    }
    values[key] = val; // mstari wa baadaye unashinda
  }
  for (const [k, v] of Object.entries(values)) {
    if (process.env[k] === undefined) process.env[k] = v; // env halisi ina kipaumbele
  }
}

function int(v, d, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return d;
  return Math.min(max, Math.max(min, n));
}
function num(v, d, min, max) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return d;
  return Math.min(max, Math.max(min, n));
}

loadEnv(path.join(ROOT, '.env'));
const env = process.env;

const PLACEHOLDER_KEYS = new Set(['', 'your_groq_api_key_here', 'changeme']);
const rawKey = (env.GROQ_API_KEY || '').trim();

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  port: int(env.PORT, 3000, 1, 65535),
  host: (env.HOST || '127.0.0.1').trim(),
  groqApiKey: PLACEHOLDER_KEYS.has(rawKey) ? '' : rawKey,
  groqBaseUrl: (env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, ''),
  groqModel: (env.GROQ_MODEL || 'openai/gpt-oss-120b').trim(),
  maxOutputTokens: int(env.MAX_OUTPUT_TOKENS, 1024, 64, 8192),
  temperature: num(env.TEMPERATURE, 0.7, 0, 2),
  maxMessageChars: int(env.MAX_MESSAGE_CHARS, 4000, 100, 20000),
  maxHistoryMessages: int(env.MAX_HISTORY_MESSAGES, 20, 2, 100),
  requestTimeoutMs: int(env.REQUEST_TIMEOUT_MS, 30000, 1000, 120000),
  rateLimitPerMin: int(env.RATE_LIMIT_PER_MIN, 20, 1, 1000),
  maxBodyBytes: 256 * 1024,
  trustProxy: (env.TRUST_PROXY || '').trim() === 'true',
  accessCode: (env.ACCESS_CODE || '').trim(),
  image: {
    url: (env.IMAGE_API_URL || '').trim(),
    key: (env.IMAGE_API_KEY || '').trim(),
    model: (env.IMAGE_MODEL || '').trim(),
    size: (env.IMAGE_SIZE || '1024x1024').trim(),
  },
};
