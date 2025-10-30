/**
 * Optional helper: use OpenAI (server-side) to translate example utterances to
 * multiple languages to bootstrap multilingual training data.
 *
 * Usage:
 * 1) npm install openai node-fetch@2
 * 2) set OPENAI_API_KEY env var locally or use .env and load it
 * 3) node tools/translate_augment.js
 *
 * The script reads supabase/functions/chatbot/training/intents.json and
 * appends translated examples for the languages list. It writes a new file
 * intents.multilingual.json which you can review before training.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const TRAIN_FILE = path.join(__dirname, '..', 'supabase', 'functions', 'chatbot', 'training', 'intents.json');
const OUT_FILE = path.join(__dirname, '..', 'supabase', 'functions', 'chatbot', 'training', 'intents.multilingual.json');

const LANGS = ['es', 'fr', 'de', 'pt', 'it', 'nl', 'ru', 'zh'];

async function translate(text, target) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY required');
  const prompt = `Translate the following short user utterance to ${target} language only (no extra text):\n\n${text}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 200 })
  });
  const j = await res.json();
  return (j?.choices?.[0]?.message?.content || '').trim();
}

async function main() {
  const raw = fs.readFileSync(TRAIN_FILE, 'utf8');
  const base = JSON.parse(raw);
  const out = { intents: [] };
  for (const intent of base.intents) {
    const examples = [...intent.examples];
    for (const lang of LANGS) {
      for (const ex of intent.examples) {
        try {
          const t = await translate(ex, lang);
          if (t) examples.push(t);
        } catch (err) { console.warn('translate error', err); }
      }
    }
    out.intents.push({ intent: intent.intent, examples });
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote multilingual training to', OUT_FILE);
}

main().catch(err => { console.error(err); process.exit(1); });
