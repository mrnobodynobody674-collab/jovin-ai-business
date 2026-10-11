(() => {
  'use strict';

  // ---------- Huduma (modes) ----------
  const MODES = {
    chat: {
      placeholder: 'Andika swali lako…',
      title: 'Habari! Mimi ni Jovin AI 👋',
      text: 'Niulize chochote kwa Kiswahili au English: biashara, elimu, teknolojia, programming, uandishi na mengine.',
      note: '',
      chips: [
        'Nieleze kwa urahisi jinsi AI inavyofanya kazi',
        'Nisaidie kuandika barua ya maombi ya kazi',
        'Explain what an API is with a simple example',
      ],
    },
    business: {
      placeholder: 'Eleza wazo lako la biashara…',
      title: 'Msaidizi wa Biashara 💼',
      text: 'Mipango ya biashara ya mtandaoni, bidhaa, masoko na huduma kwa wateja.',
      note: 'Hakuna dhamana ya faida. Mapendekezo ni mwongozo tu; fanya utafiti na uanze kwa mtaji mdogo.',
      chips: [
        'Nipe mpango wa biashara ya mtandaoni yenye mtaji mdogo Tanzania',
        'Njia halisi za kuingiza kipato kwa app ya wabunifu (creators)',
        'Andika ujumbe wa kuwakaribisha wateja wapya WhatsApp',
      ],
    },
    image: {
      placeholder: 'Eleza picha unayotaka…',
      title: 'Picha 🖼️',
      text: 'Nitakusaidia kuandika prompt za kina za picha. Mimi sijatengeneza picha mwenyewe; prompt unaweza kuitumia kwenye zana ya picha.',
      note: '',
      chips: [
        'Prompt ya picha ya soko la Kariakoo wakati wa jioni',
        'Logo ya duka la nguo, mtindo wa kisasa, rangi za zambarau na cyan',
        'Create a product photo prompt for handmade soap',
      ],
    },
    video: {
      placeholder: 'Eleza video unayotaka…',
      title: 'Video 🎬',
      text: 'Mawazo ya video, script, scene, maelezo (captions) na prompts.',
      note: 'Jovin AI inatengeneza maandishi tu (mawazo, script, prompts). Haitengenezi faili la video. Video halisi inahitaji huduma ya nje ya video yenye API key na kwa kawaida gharama.',
      chips: [
        'Script ya video ya sekunde 30 ya kutangaza duka la mtandaoni',
        'Mawazo 10 ya video fupi za TikTok kuhusu teknolojia',
        'Write a scene-by-scene plan for a 1-minute explainer video',
      ],
    },
  };

  const STORE_KEY = 'jovin.histories.v1';
  const ACCESS_KEY = 'jovin.access';
  const $ = (id) => document.getElementById(id);
  const els = {
    messages: $('messages'), input: $('input'), form: $('composer'), send: $('sendBtn'),
    mic: $('micBtn'), lang: $('lang'), clear: $('clearBtn'), autoSpeak: $('autoSpeak'),
    dot: $('dot'), statusText: $('statusText'), note: $('modeNote'), toast: $('toast'),
    imagePanel: $('imagePanel'), imgPrompt: $('imgPrompt'), imgBtn: $('imgBtn'),
    imgCopy: $('imgCopy'), imgResult: $('imgResult'),
  };

  const state = {
    mode: 'chat',
    histories: { chat: [], business: [], image: [], video: [] },
    busy: false,
    features: { chat: false, imageGeneration: false },
    accessRequired: false,
    autoSpeak: false,
    listening: false,
  };

  // ---------- Hifadhi ya mazungumzo (kwenye kivinjari tu) ----------
  function loadHistories() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const k of Object.keys(state.histories)) {
        if (Array.isArray(data[k])) {
          state.histories[k] = data[k]
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-40);
        }
      }
    } catch (e) { /* hifadhi haipatikani */ }
  }
  function saveHistories() {
    try {
      const out = {};
      for (const k of Object.keys(state.histories)) out[k] = state.histories[k].slice(-40);
      localStorage.setItem(STORE_KEY, JSON.stringify(out));
    } catch (e) { /* ignore */ }
  }
  const getCode = () => { try { return sessionStorage.getItem(ACCESS_KEY) || ''; } catch (e) { return ''; } };
  const setCode = (c) => { try { sessionStorage.setItem(ACCESS_KEY, c); } catch (e) { /* ignore */ } };
  const clearCode = () => { try { sessionStorage.removeItem(ACCESS_KEY); } catch (e) { /* ignore */ } };

  // ---------- UI ndogo ----------
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 4000);
  }
  function setStatus(text, kind) {
    els.statusText.textContent = text;
    els.dot.className = 'dot' + (kind ? ' ' + kind : '');
  }
  function autosize() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 140) + 'px';
  }
  function scrollDown() { els.messages.scrollTop = els.messages.scrollHeight; }

  // ---------- Uonyeshaji salama wa maandishi (escape kisha format ndogo) ----------
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(s) {
    return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  function block(t) {
    let out = '';
    let list = null;
    const close = () => { if (list) { out += '</' + list + '>'; list = null; } };
    for (const raw of t.split('\n')) {
      const line = raw.trimEnd();
      let m;
      if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
        if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; }
        out += '<li>' + fmt(m[1]) + '</li>';
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
        if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; }
        out += '<li>' + fmt(m[1]) + '</li>';
      } else if ((m = line.match(/^#{1,6}\s+(.*)/))) {
        close(); out += '<p><strong>' + fmt(m[1]) + '</strong></p>';
      } else if (line.trim() === '') {
        close();
      } else {
        close(); out += '<p>' + fmt(line) + '</p>';
      }
    }
    close();
    return out;
  }
  function renderRich(text) {
    return text.split('```').map((part, i) => {
      if (i % 2 === 1) return '<pre><code>' + esc(part.replace(/^[a-zA-Z0-9_+-]*\n/, '')) + '</code></pre>';
      return block(esc(part));
    }).join('');
  }
  function stripMd(t) {
    return t.replace(/```[\s\S]*?```/g, ' ').replace(/[`*#>_]/g, '').replace(/\s+/g, ' ').trim();
  }

  // ---------- Viputo vya ujumbe ----------
  function addBubble(role, text, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (role === 'assistant') bubble.innerHTML = renderRich(text);
    else bubble.textContent = text;
    wrap.appendChild(bubble);

    if (role === 'assistant') {
      if (opts.truncated) {
        const n = document.createElement('div');
        n.className = 'note';
        n.textContent = 'Jibu limekatwa kwa kikomo cha urefu. Andika "endelea" ili kupata sehemu iliyobaki.';
        wrap.appendChild(n);
      }
      const actions = document.createElement('div');
      actions.className = 'actions';
      const speakBtn = document.createElement('button');
      speakBtn.type = 'button'; speakBtn.className = 'mini'; speakBtn.textContent = '🔊 Soma';
      speakBtn.addEventListener('click', () => speak(text));
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button'; copyBtn.className = 'mini'; copyBtn.textContent = '📋 Nakili';
      copyBtn.addEventListener('click', () => copyText(text));
      actions.append(speakBtn, copyBtn);
      wrap.appendChild(actions);
    }
    els.messages.appendChild(wrap);
    scrollDown();
    return wrap;
  }
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    const b = document.createElement('div');
    b.className = 'bubble typing';
    b.setAttribute('aria-label', 'Jovin AI inaandika');
    b.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(b);
    els.messages.appendChild(wrap);
    scrollDown();
    return wrap;
  }

  function renderAll() {
    els.messages.textContent = '';
    const cfg = MODES[state.mode];
    const hist = state.histories[state.mode];
    if (!hist.length) {
      const w = document.createElement('div');
      w.className = 'welcome';
      const h = document.createElement('h2'); h.textContent = cfg.title;
      const p = document.createElement('p'); p.textContent = cfg.text;
      const chips = document.createElement('div'); chips.className = 'chips';
      for (const c of cfg.chips) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = c;
        b.addEventListener('click', () => send(c));
        chips.appendChild(b);
      }
      w.append(h, p, chips);
      els.messages.appendChild(w);
    } else {
      for (const m of hist) addBubble(m.role, m.content);
    }
    els.input.placeholder = cfg.placeholder;
    updateNote();
    els.imagePanel.hidden = state.mode !== 'image';
    scrollDown();
  }

  function updateNote() {
    let note = MODES[state.mode].note;
    if (state.mode === 'image') {
      note = state.features.imageGeneration
        ? 'Uzalishaji wa picha umewashwa kupitia API ya nje (inaweza kuwa na gharama). Andika prompt chini ili kutengeneza picha.'
        : 'Uzalishaji wa picha HAUJAWASHWA. Jovin AI inatengeneza prompt tu. Ili kuwasha, weka IMAGE_API_URL na IMAGE_API_KEY kwenye .env.';
    }
    els.note.textContent = note;
    els.note.hidden = !note;
  }

  function setBusy(b) {
    state.busy = b;
    els.send.disabled = b;
    els.imgBtn.disabled = b;
  }

  // ---------- Mawasiliano na seva ----------
  class ApiError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }
  async function api(path, body, timeoutMs = 60000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const headers = { 'Content-Type': 'application/json' };
    const code = getCode();
    if (code) headers['X-Access-Code'] = code;
    let res;
    try {
      res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) {
      throw new ApiError(
        e.name === 'AbortError'
          ? 'Ombi limechukua muda mrefu. Jaribu tena.'
          : 'Hakuna mawasiliano na seva. Hakikisha seva inafanya kazi (npm start) na una intaneti.',
        'NETWORK'
      );
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* si JSON */ }
    if (!res.ok) {
      const err = data && data.error;
      if (res.status === 401 && err && err.code === 'ACCESS_DENIED') clearCode();
      throw new ApiError((err && err.message) || 'Hitilafu ya seva (' + res.status + ').', (err && err.code) || 'HTTP_' + res.status);
    }
    return data;
  }

  function ensureAccess() {
    if (!state.accessRequired || getCode()) return true;
    const c = window.prompt('Weka msimbo wa ufikiaji (ACCESS_CODE):');
    if (!c || !c.trim()) { toast('Msimbo wa ufikiaji unahitajika.'); return false; }
    setCode(c.trim());
    return true;
  }

  async function send(raw) {
    const text = (raw || '').trim();
    if (!text || state.busy) return;
    if (!ensureAccess()) return;

    const mode = state.mode;
    const hist = state.histories[mode];
    hist.push({ role: 'user', content: text });
    if (mode === state.mode && hist.length === 1) els.messages.textContent = '';
    const userBubble = addBubble('user', text);
    els.input.value = '';
    autosize();
    setBusy(true);
    const typing = showTyping();

    try {
      const data = await api('/api/chat', { mode, messages: hist.slice(-20) });
      hist.push({ role: 'assistant', content: data.reply });
      saveHistories();
      typing.remove();
      if (mode === state.mode) addBubble('assistant', data.reply, { truncated: data.truncated });
      if (state.autoSpeak) speak(data.reply);
    } catch (e) {
      hist.pop(); // ondoa ujumbe uliofeli ili kuutuma tena bila kurudia
      typing.remove();
      userBubble.remove();
      if (mode === state.mode) {
        els.input.value = text;
        autosize();
        addBubble('error', e.message);
        if (!hist.length) renderAll();
      }
    } finally {
      setBusy(false);
    }
  }

  // ---------- Nakili ----------
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      toast('Imenakiliwa ✓');
    } catch (e) {
      toast('Imeshindwa kunakili. Bonyeza na ushikilie maandishi ili kunakili.');
    }
  }

  // ---------- Sauti: kusoma majibu (TTS) ----------
  function speak(text) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      toast('Kusoma kwa sauti hakutumiki kwenye kivinjari hiki. Jaribu Chrome.');
      return;
    }
    const clean = stripMd(text).slice(0, 4000);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = els.lang.value;
    const voices = window.speechSynthesis.getVoices() || [];
    const base = els.lang.value.slice(0, 2).toLowerCase();
    const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(base));
    if (v) u.voice = v;
    else if (voices.length) toast('Sauti ya lugha hii haipo kwenye kifaa chako; sauti nyingine itatumika.');
    window.speechSynthesis.speak(u);
  }

  // ---------- Sauti: kuongea (Speech Recognition) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  function setListening(on) {
    state.listening = on;
    els.mic.classList.toggle('listening', on);
    els.mic.setAttribute('aria-pressed', String(on));
  }
  function toggleMic() {
    if (!SR) {
      toast('Kuongea hakutumiki kwenye kivinjari hiki. Andika ujumbe, au tumia Chrome.');
      return;
    }
    if (state.listening && recognizer) { recognizer.stop(); return; }
    recognizer = new SR();
    recognizer.lang = els.lang.value;
    recognizer.interimResults = true;
    recognizer.continuous = false;
    const base = els.input.value ? els.input.value.trimEnd() + ' ' : '';
    recognizer.onresult = (ev) => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      els.input.value = base + t;
      autosize();
    };
    recognizer.onerror = (ev) => {
      const map = {
        'not-allowed': 'Ruhusa ya kipaza sauti imekataliwa. Ruhusu kipaza sauti kwenye kivinjari.',
        'service-not-allowed': 'Huduma ya kutambua sauti haijaruhusiwa kwenye kivinjari hiki.',
        'no-speech': 'Sikusikia sauti. Jaribu tena.',
        'network': 'Kutambua sauti kunahitaji intaneti.',
        'audio-capture': 'Kipaza sauti hakipatikani.',
      };
      toast(map[ev.error] || 'Hitilafu ya sauti: ' + ev.error);
    };
    recognizer.onend = () => setListening(false);
    try {
      recognizer.start();
      setListening(true);
    } catch (e) {
      setListening(false);
      toast('Imeshindwa kuanza kipaza sauti.');
    }
  }

  // ---------- Picha (API ya nje, hiari) ----------
  async function generateImage() {
    const prompt = els.imgPrompt.value.trim();
    if (!prompt) { toast('Andika prompt ya picha kwanza.'); return; }
    if (!state.features.imageGeneration) {
      els.imgResult.textContent =
        'Uzalishaji wa picha haujawashwa kwenye seva. Weka IMAGE_API_URL na IMAGE_API_KEY kwenye .env, au tumia prompt hii kwenye zana ya picha unayopendelea (bonyeza "Nakili prompt").';
      return;
    }
    if (!ensureAccess()) return;
    setBusy(true);
    els.imgResult.textContent = 'Inatengeneza picha…';
    try {
      const data = await api('/api/image', { prompt }, 120000);
      const src = data.dataUrl || data.url;
      if (!src) throw new ApiError('Hakuna picha iliyorudishwa.', 'IMAGE_EMPTY');
      els.imgResult.textContent = '';
      const img = document.createElement('img');
      img.src = src;
      img.alt = prompt;
      img.loading = 'lazy';
      els.imgResult.appendChild(img);
      const a = document.createElement('a');
      a.href = src; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.download = 'jovin-ai-picha.png';
      a.textContent = 'Fungua / pakua picha';
      els.imgResult.appendChild(a);
    } catch (e) {
      els.imgResult.textContent = e.message;
    } finally {
      setBusy(false);
    }
  }

  // ---------- Matukio ----------
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.mode === state.mode) return;
      state.mode = tab.dataset.mode;
      document.querySelectorAll('.tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
      });
      renderAll();
    });
  });

  els.form.addEventListener('submit', (e) => { e.preventDefault(); send(els.input.value); });
  els.input.addEventListener('input', autosize);
  els.input.addEventListener('keydown', (e) => {
    const desktop = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (e.key === 'Enter' && !e.shiftKey && desktop) { e.preventDefault(); send(els.input.value); }
  });
  els.mic.addEventListener('click', toggleMic);
  els.clear.addEventListener('click', () => {
    if (!state.histories[state.mode].length) { toast('Hakuna mazungumzo ya kufuta.'); return; }
    if (!window.confirm('Futa mazungumzo ya huduma hii?')) return;
    state.histories[state.mode] = [];
    saveHistories();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    renderAll();
  });
  els.autoSpeak.addEventListener('click', () => {
    state.autoSpeak = !state.autoSpeak;
    els.autoSpeak.setAttribute('aria-pressed', String(state.autoSpeak));
    els.autoSpeak.textContent = state.autoSpeak ? '🔊' : '🔈';
    if (state.autoSpeak && !('speechSynthesis' in window)) {
      toast('Kusoma kwa sauti hakutumiki kwenye kivinjari hiki.');
    } else {
      toast(state.autoSpeak ? 'Majibu yatasomwa kwa sauti.' : 'Kusoma kiotomatiki kumezimwa.');
    }
  });
  els.imgBtn.addEventListener('click', generateImage);
  els.imgCopy.addEventListener('click', () => {
    const t = els.imgPrompt.value.trim();
    if (!t) { toast('Hakuna prompt ya kunakili.'); return; }
    copyText(t);
  });

  // ---------- Kuanza ----------
  async function init() {
    loadHistories();
    renderAll();
    if (!SR) els.mic.title = 'Kuongea hakutumiki kwenye kivinjari hiki';
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) throw new Error('config');
      const cfg = await res.json();
      state.features = cfg.features || state.features;
      state.accessRequired = Boolean(cfg.accessCodeRequired);
      if (cfg.maxMessageChars) els.input.maxLength = cfg.maxMessageChars;
      if (cfg.features && cfg.features.chat) setStatus('Tayari', 'ok');
      else setStatus('Ufunguo wa Groq haujawekwa', 'bad');
      updateNote();
    } catch (e) {
      setStatus('Seva haipatikani', 'bad');
    }
  }
  init();
})();
