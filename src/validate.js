'use strict';
const config = require('./config');
const { MODES } = require('./modes');
const { AppError } = require('./http');

const ASSISTANT_MAX_CHARS = 12000;

function validateChat(body) {
  const mode = body.mode === undefined ? 'chat' : body.mode;
  if (typeof mode !== 'string' || !Object.prototype.hasOwnProperty.call(MODES, mode)) {
    throw new AppError(400, 'INVALID_MODE', 'Huduma (mode) si sahihi.');
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new AppError(400, 'INVALID_MESSAGES', 'Tuma orodha ya ujumbe (messages) isiyo tupu.');
  }

  let messages = [];
  for (const m of body.messages) {
    if (!m || typeof m !== 'object' || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      throw new AppError(400, 'INVALID_MESSAGES', 'Kila ujumbe unahitaji role (user/assistant) na content (maandishi).');
    }
    let content = m.content.trim();
    if (!content) throw new AppError(400, 'EMPTY_MESSAGE', 'Ujumbe hauwezi kuwa tupu.');
    if (m.role === 'user') {
      if (content.length > config.maxMessageChars) {
        throw new AppError(400, 'MESSAGE_TOO_LONG', `Ujumbe ni mrefu mno (kikomo: herufi ${config.maxMessageChars}).`);
      }
    } else if (content.length > ASSISTANT_MAX_CHARS) {
      content = content.slice(0, ASSISTANT_MAX_CHARS);
    }
    messages.push({ role: m.role, content });
  }

  if (messages[messages.length - 1].role !== 'user') {
    throw new AppError(400, 'INVALID_MESSAGES', 'Ujumbe wa mwisho lazima uwe wa mtumiaji (user).');
  }
  messages = messages.slice(-config.maxHistoryMessages);
  while (messages.length > 1 && messages[0].role !== 'user') messages.shift();

  return { mode, messages };
}

function validateImage(body) {
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    throw new AppError(400, 'INVALID_PROMPT', 'Andika maelezo ya picha (prompt).');
  }
  const prompt = body.prompt.trim();
  if (prompt.length > 1000) {
    throw new AppError(400, 'PROMPT_TOO_LONG', 'Prompt ni ndefu mno (kikomo: herufi 1000).');
  }
  return { prompt };
}

module.exports = { validateChat, validateImage };
