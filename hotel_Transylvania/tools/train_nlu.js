/**
 * Train a simple intent classifier using node-nlp (nlp.js) from training data.
 *
 * Usage:
 * 1) npm install node-nlp
 * 2) node tools/train_nlu.js
 *
 * Output: writes model to ./nlu/model.nlp which can be loaded by a Node-based
 * NLU server. You can then serve that model as a small HTTP endpoint and have
 * your chatbot function call it for fast intent classification.
 */

const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');

async function main() {
  const dataFile = path.join(__dirname, '..', 'supabase', 'functions', 'chatbot', 'training', 'intents.json');
  if (!fs.existsSync(dataFile)) {
    console.error('training data not found:', dataFile);
    process.exit(1);
  }
  const raw = fs.readFileSync(dataFile, 'utf8');
  const json = JSON.parse(raw);

  const manager = new NlpManager({ languages: ['en'], forceNER: true });

  for (const intent of json.intents || []) {
    const intentName = intent.intent;
    for (const ex of intent.examples || []) {
      manager.addDocument('en', ex, intentName);
    }
    // add a short canned answer as fallback (optional)
    manager.addAnswer('en', intentName, `(intent:${intentName})`);
  }

  console.log('Training NLU model...');
  await manager.train();
  const outDir = path.join(__dirname, 'nlu');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const modelFile = path.join(outDir, 'model.nlp');
  manager.save(modelFile);
  console.log('Saved model to', modelFile);
}

main().catch(err => { console.error(err); process.exit(2); });
