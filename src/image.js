'use strict';
// Uzalishaji wa picha kupitia API ya nje inayoweza kusanidiwa (hiari).
// Inatarajia muundo wa "images/generations" wa OpenAI. HAIJAJARIBIWA na huduma yoyote maalum.
const config = require('./config');
const { AppError } = require('./http');

function isConfigured() {
  return Boolean(config.image.url && config.image.key);
}

async function generate(prompt) {
  if (!isConfigured()) {
    throw new AppError(
      501,
      'IMAGE_NOT_CONFIGURED',
      'Uzalishaji wa picha haujawashwa. Weka IMAGE_API_URL na IMAGE_API_KEY kwenye .env (huduma ya nje, inaweza kuwa na gharama).'
    );
  }
  const payload = { prompt, n: 1, size: config.image.size };
  if (config.image.model) payload.model = config.image.model;

  let res;
  try {
    res = await fetch(config.image.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.image.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Math.max(config.requestTimeoutMs, 60000)),
    });
  } catch (e) {
    throw new AppError(502, 'IMAGE_NETWORK', 'Imeshindwa kuunganisha na huduma ya picha.');
  }

  let data = null;
  try {
    data = JSON.parse(await res.text());
  } catch (e) {
    /* si JSON */
  }
  if (!res.ok) {
    throw new AppError(502, 'IMAGE_UPSTREAM', `Huduma ya picha imerudisha hitilafu (${res.status}).`);
  }
  const item = data && Array.isArray(data.data) && data.data[0];
  if (item && typeof item.b64_json === 'string' && /^[A-Za-z0-9+/=]+$/.test(item.b64_json)) {
    return { dataUrl: `data:image/png;base64,${item.b64_json}` };
  }
  if (item && typeof item.url === 'string' && /^https:\/\//.test(item.url)) {
    return { url: item.url };
  }
  throw new AppError(502, 'IMAGE_EMPTY', 'Huduma ya picha haikurudisha picha inayoeleweka.');
}

module.exports = { isConfigured, generate };
