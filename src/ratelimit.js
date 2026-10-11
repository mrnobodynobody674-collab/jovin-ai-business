'use strict';
// Kikomo rahisi cha maombi (kwenye kumbukumbu) kwa kila ufunguo (IP).

function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  timer.unref();

  return {
    check(key) {
      const now = Date.now();
      if (hits.size > 10000) hits.clear(); // kinga ya kumbukumbu
      let entry = hits.get(key);
      if (!entry || entry.reset <= now) {
        entry = { count: 0, reset: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return {
        allowed: entry.count <= max,
        retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1000)),
      };
    },
  };
}

module.exports = { createLimiter };
