'use strict';
// ============================================================
// MAANDALIZI YA BAADAYE - HAYAJAWASHWA
// Akaunti, mipango ya Free/Paid, vikomo vya matumizi, malipo na admin
// HAVIJATENGENEZWA bado. Faili hili ni sehemu ya kuunganisha tu.
// ============================================================

const ENABLED = false; // Hakuna akaunti wala malipo yaliyowashwa.

// Mfano wa muundo wa mipango (si halisi, hakuna bei wala malipo).
const PLANS = {
  free: { id: 'free', dailyMessages: null, note: 'placeholder' },
  premium: { id: 'premium', dailyMessages: null, note: 'placeholder' },
};

// Itaitwa kabla ya kila ombi la AI. Kwa sasa inaruhusu kila kitu.
// Baadaye: tambua mtumiaji (token), angalia mpango na matumizi ya leo.
function checkQuota(/* ctx */) {
  return { allowed: true, reason: 'accounts-not-enabled' };
}

module.exports = { ENABLED, PLANS, checkQuota };
