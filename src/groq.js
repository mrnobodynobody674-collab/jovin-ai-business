'use strict';
// Mawasiliano na Groq (muundo unaoendana na OpenAI). Ufunguo unabaki kwenye seva.
const config = require('./config');
const { MODES } = require('./modes');
const { AppError } = require('./http');

function safeDetail(data) {
  let msg = data && data.error && typeof data.error.message === 'string' ? data.error.message : '';
  if (config.groqApiKey) msg = msg.split(config.groqApiKey).join('***');
  return msg.slice(0, 200);
}

async function chat(mode, messages) {
  const payload = {
    model: config.groqModel,
    messages: [{ role: 'system', content: MODES[mode].system }, ...messages],
    max_tokens: config.maxOutputTokens,
    temperature: config.temperature,
  };

  let res;
  try {
    res = await fetch(`${config.groqBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new AppError(504, 'AI_TIMEOUT', 'Groq imechelewa kujibu. Jaribu tena.');
    }
    throw new AppError(502, 'AI_NETWORK', 'Imeshindwa kuunganisha na Groq. Angalia intaneti yako.');
  }

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    /* jibu si JSON */
  }

  if (!res.ok) {
    const s = res.status;
    if (s === 401 || s === 403) {
      throw new AppError(502, 'AI_AUTH', 'Ufunguo wa Groq si sahihi au hauna ruhusa. Angalia GROQ_API_KEY kwenye .env.');
    }
    if (s === 429) {
      throw new AppError(503, 'AI_RATE_LIMIT', 'Groq imepokea maombi mengi sana. Subiri kidogo kisha jaribu tena.');
    }
    if (s === 400 || s === 404) {
      const d = safeDetail(data);
      throw new AppError(502, 'AI_BAD_REQUEST', 'Groq imekataa ombi' + (d ? ': ' + d : '. Angalia GROQ_MODEL.'));
    }
    throw new AppError(502, 'AI_UPSTREAM', 'Huduma ya Groq ina hitilafu kwa sasa. Jaribu tena baadaye.');
  }

  const choice = data && data.choices && data.choices[0];
  const reply = choice && choice.message && choice.message.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new AppError(502, 'AI_EMPTY', 'AI haikurudisha jibu. Jaribu tena.');
  }
  return {
    reply: reply.trim(),
    model: data.model || config.groqModel,
    truncated: choice.finish_reason === 'length',
  };
}

module.exports = { chat };
