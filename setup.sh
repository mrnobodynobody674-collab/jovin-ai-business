#!/usr/bin/env bash
# Jovin AI - usanidi salama wa ufunguo wa Groq (haionyeshi ufunguo skrini).
set -e
cd "$(dirname "$0")"

if [ -f .env ]; then
  read -r -p ".env tayari ipo. Unataka kuibadilisha? (y/N): " ans
  [ "$ans" = "y" ] || { echo "Hakuna mabadiliko."; exit 0; }
fi

cp .env.example .env
read -rs -p "Bandika GROQ_API_KEY yako (haitaonekana unapoandika): " KEY
echo
if [ -z "$KEY" ]; then
  echo "Hukuweka ufunguo. Hariri .env baadaye: nano .env"
  exit 1
fi
KEY="$KEY" node -e "
const fs=require('fs');
let t=fs.readFileSync('.env','utf8');
t=t.replace(/^GROQ_API_KEY=.*\$/m,()=>'GROQ_API_KEY='+process.env.KEY);
fs.writeFileSync('.env',t,{mode:0o600});
"
unset KEY
chmod 600 .env 2>/dev/null || true
echo "Imekamilika! Ufunguo umehifadhiwa kwenye .env. Sasa endesha: npm start"
