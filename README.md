# Jovin AI

Msaidizi wa AI (Kiswahili + English) unaoendeshwa kwenye **Android/Termux**.
Node.js + Groq API. **Hakuna dependencies za nje** (hakuna `npm install` ya packages, hakuna native build).

> Ufunguo wa Groq unabaki kwenye seva (`.env`). Haupo kwenye JavaScript ya kivinjari wala kwenye code.

---

## 1. Hali halisi ya vipengele (soma kwanza)

| Kipengele | Hali |
|---|---|
| Chat (Kiswahili/English, historia, follow-up) | ✅ Imetengenezwa. Imejaribiwa na Groq bandia (mock). **Haijajaribiwa na Groq halisi** (hakukuwa na ufunguo/intaneti wakati wa kutengeneza). |
| Biashara / Picha (prompts) / Video (mawazo, script) | ✅ Ni modes za chat zenye maelekezo maalum. Zinatoa **maandishi tu**. |
| Kuongea (speech recognition) | ⚠️ Imetengenezwa; inategemea kivinjari (Chrome ya Android kwa kawaida inafaa, inahitaji intaneti). Haijajaribiwa kwenye kifaa halisi. Kuna ujumbe mbadala ikiwa haitumiki. |
| Kusoma majibu kwa sauti (TTS) | ⚠️ Kama hapo juu. Kifaa kinaweza kukosa sauti ya Kiswahili. |
| Uzalishaji wa picha | ⚠️ **Imezimwa kwa chaguo-msingi.** Inahitaji `IMAGE_API_URL` + `IMAGE_API_KEY` (huduma ya nje, inaweza kuwa na gharama, muundo wa OpenAI `images/generations`). Haijajaribiwa na huduma yoyote. |
| Uzalishaji wa video | ❌ **Haupo.** Jovin AI inatoa mawazo/script/prompts tu. Video halisi inahitaji huduma ya nje yenye API na gharama; haijaunganishwa. |
| Akaunti, mipango Free/Paid, vikomo vya matumizi, malipo (Tanzania), admin dashboard | ❌ **Havipo bado.** `src/plans.js` ni kiunganishi tupu tu (kinaruhusu kila kitu). Malipo hayatawekwa hadi uwe na credentials za mtoa huduma. |
| Ulinzi: rate limit, ACCESS_CODE, validation, kikomo cha ukubwa | ✅ Imetengenezwa na kujaribiwa. |

---

## 2. Muundo wa mradi

```
jovin-ai/
├── index.js            seva kuu (router, usalama, static files)
├── package.json
├── setup.sh            usanidi salama wa ufunguo
├── .env.example        mfano wa mipangilio
├── .gitignore
├── src/
│   ├── config.js       husoma .env
│   ├── groq.js         mawasiliano na Groq
│   ├── image.js        picha (API ya nje, hiari)
│   ├── modes.js        maelekezo ya Chat/Biashara/Picha/Video
│   ├── validate.js     ukaguzi wa data
│   ├── ratelimit.js    kikomo cha maombi
│   ├── http.js         vifaa vya HTTP
│   └── plans.js        maandalizi ya baadaye (HAYAJAWASHWA)
├── public/             index.html, style.css, app.js, favicon.svg
└── test/smoke.js       majaribio ya kiotomatiki
```

---

## 3. Usakinishaji kwenye Android Termux (hatua kwa hatua)

Kila amri ina maelezo kwa Kiswahili rahisi.

**Hatua 1: Sakinisha Node.js na unzip**
```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts unzip curl -y
```
Inasasisha Termux, kisha inaweka Node.js (injini ya kuendesha Jovin AI), `unzip` (kufungua ZIP) na `curl` (kujaribu seva).

**Hatua 2: Ruhusu Termux kuona faili za simu** (mara moja tu)
```bash
termux-setup-storage
```
Itaomba ruhusa; bonyeza "Allow". Kisha faili zako za Downloads zinaonekana kwenye `~/storage/downloads`.

**Hatua 3: Fungua (extract) ZIP**
```bash
cd ~
cp ~/storage/downloads/jovin-ai.zip .
unzip jovin-ai.zip
cd jovin-ai
```
Inanakili ZIP kwenye folda yako ya Termux, inaifungua, kisha inaingia kwenye folda `jovin-ai`.

**Hatua 4: Weka ufunguo wa Groq bila kuuonyesha**
```bash
bash setup.sh
```
Itakuuliza ufunguo; **bandika (paste)** na bonyeza Enter. Hautaonekana skrini. Script inaunda `.env` na kuhifadhi ufunguo ndani yake.
Pata ufunguo kwenye https://console.groq.com. **Usimtumie mtu yeyote ufunguo wako wala usiweke `.env` kwenye GitHub.**

(Njia nyingine: `cp .env.example .env` kisha `nano .env` na uandike `GROQ_API_KEY=...`)

**Hatua 5: Anzisha seva**
```bash
npm start
```
Inaanzisha Jovin AI. Utaona ujumbe "Jovin AI inafanya kazi".

**Hatua 6: Fungua kwenye kivinjari cha simu**

Fungua Chrome kisha andika: `http://localhost:3000`

**Hatua 7: Simamisha na uanzishe tena**
- Kusimamisha: kwenye Termux bonyeza `Ctrl` + `C` (kwenye kibodi ya Termux: kitufe cha `CTRL` kisha `c`).
- Kuanzisha tena: `npm start`.
- Kuendesha nyuma (background) ili Termux ikifungwa iendelee:
  ```bash
  termux-wake-lock
  nohup npm start > jovin.log 2>&1 &
  ```
  Kusimamisha ya nyuma: `pkill -f "node index.js"`
  Kuona logs: `tail -f jovin.log`

**Windows (kama unatumia kompyuta):** `copy .env.example .env`, hariri `.env`, kisha `npm start`.

---

## 4. Kujaribu (testing)

Fungua Termux kipindi cha pili (swipe kutoka kushoto kwenye Termux > "New session") wakati seva inaendelea.

**a) Health check**
```bash
curl http://127.0.0.1:3000/api/health
```
Inapaswa kurudisha `{"status":"ok",...,"aiConfigured":true}`.

**b) Chat API**
```bash
curl -s -X POST http://127.0.0.1:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"chat","messages":[{"role":"user","content":"Habari! Jitambulishe kwa Kiswahili."}]}'
```
Inapaswa kurudisha `{"reply":"...","model":"...","truncated":false}`.

**c) Jaribio la kosa: ufunguo haupo**
Simamisha seva (Ctrl+C), kisha:
```bash
GROQ_API_KEY= npm start
```
Kwenye kipindi kingine:
```bash
curl -s -X POST http://127.0.0.1:3000/api/chat -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```
Inapaswa kurudisha `API_KEY_MISSING` (status 503). Ukurasa wa wavuti pia utaonyesha "Ufunguo wa Groq haujawekwa".

**d) Frontend inawasiliana na backend**
Fungua `http://localhost:3000`. Hali (juu) inapaswa kusema **"Tayari"** (kijani). Tuma ujumbe; jibu likitokea, frontend na backend vinawasiliana.

**e) Majaribio ya kiotomatiki (hayahitaji intaneti wala ufunguo)**
```bash
npm test
```
Yanatumia Groq bandia na kukagua health, chat, validation, makosa (401/429/500), ufunguo kukosekana, rate limit, ACCESS_CODE, usalama wa njia za faili, na kwamba ufunguo haufichuki.

### Orodha ya kuthibitisha (jaza mwenyewe baada ya kujaribu na ufunguo wako)
- [ ] `npm test` inapita yote
- [ ] Health check inarudisha ok
- [ ] Chat inajibu kwa Kiswahili na English
- [ ] Follow-up inakumbuka muktadha
- [ ] Tab za Biashara / Picha / Video zinajibu
- [ ] Kitufe cha 🎤 kinafanya kazi (au kinaonyesha ujumbe mbadala)
- [ ] Kitufe cha 🔊 Soma kinasoma (au kinaonyesha ujumbe mbadala)
- [ ] Kuzima intaneti kunaonyesha kosa lililo wazi (si skrini tupu)
- [ ] Kitufe cha 🗑️ kinafuta mazungumzo

---

## 5. Mipangilio muhimu (`.env`)

| Jina | Maana | Chaguo-msingi |
|---|---|---|
| `GROQ_API_KEY` | Ufunguo wa Groq (lazima) | tupu |
| `GROQ_MODEL` | Modeli. Majina ya modeli hubadilika; angalia https://console.groq.com/docs/models kama inatoa kosa | `llama-3.3-70b-versatile` |
| `MAX_OUTPUT_TOKENS` | Kikomo cha urefu wa jibu | 1024 |
| `MAX_MESSAGE_CHARS` | Herufi za juu kwa ujumbe | 4000 |
| `RATE_LIMIT_PER_MIN` | Maombi kwa dakika kwa IP | 20 |
| `HOST` | `127.0.0.1` (simu yako tu) au `0.0.0.0` (Wi-Fi) | 127.0.0.1 |
| `ACCESS_CODE` | Msimbo wa ufikiaji (hiari) | tupu |

---

## 6. Usalama na "localhost"

- `http://localhost:3000` ni anwani **ya simu yako tu** kwa majaribio. **Si** tovuti ya umma na haipatikani na watu wengine.
- Ukiweka `HOST=0.0.0.0`, vifaa vingine kwenye Wi-Fi yako vinaweza kufungua `http://IP-YA-SIMU:3000`. **Weka `ACCESS_CODE`**, la sivyo wengine watatumia kikomo (quota) cha Groq yako.
- Kuweka mtandaoni kwa umma kunahitaji: seva ya mtandaoni (VPS/hosting), jina la domain, **HTTPS** (mfano reverse proxy kama Nginx/Caddy au Cloudflare), `TRUST_PROXY=true` nyuma ya proxy, na akaunti za watumiaji. Hayo hayajajumuishwa; `ACCESS_CODE` + rate limit ni ulinzi wa msingi tu.
- Ulinzi uliopo: ufunguo upo kwenye seva tu; ukaguzi wa data; kikomo cha ukubwa wa ombi; rate limit; headers za usalama (CSP); njia za faili zinakaguliwa (hakuna `../`); logs hazirekodi ujumbe wala ufunguo.
- Mazungumzo yanahifadhiwa kwenye kivinjari chako (localStorage), si kwenye seva. Ujumbe unatumwa kwa Groq kupata jibu; angalia sera yao ya faragha.

---

## 7. Hatua zinazofuata (hazijaanza)

Akaunti na login, mipango ya Free/Paid, vikomo vya matumizi kwa mtumiaji, malipo ya Tanzania (M-Pesa/Tigo Pesa/Airtel Money kupitia mtoa huduma utakayechagua, baada ya kupata credentials), na admin dashboard. Ongeza kwa awamu kupitia `src/plans.js` na hifadhidata.
