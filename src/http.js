'use strict';
// Vifaa vidogo vya HTTP kwa kutumia Node built-in pekee.

class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = extra.retryAfter;
  }
}

function sendJson(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let finished = false;
    const chunks = [];
    const fail = (err) => {
      if (finished) return;
      finished = true;
      reject(err);
    };
    req.on('data', (chunk) => {
      if (finished) return;
      size += chunk.length;
      if (size > limit) {
        fail(new AppError(413, 'BODY_TOO_LARGE', 'Ujumbe ni mkubwa mno.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (finished) return;
      finished = true;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) return reject(new AppError(400, 'EMPTY_BODY', 'Ombi halina data.'));
      let value;
      try {
        value = JSON.parse(text);
      } catch (e) {
        return reject(new AppError(400, 'INVALID_JSON', 'Data (JSON) si sahihi.'));
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return reject(new AppError(400, 'INVALID_JSON', 'Data (JSON) si sahihi.'));
      }
      resolve(value);
    });
    req.on('error', () => fail(new AppError(400, 'READ_ERROR', 'Imeshindwa kusoma ombi.')));
  });
}

module.exports = { AppError, sendJson, readJsonBody };
