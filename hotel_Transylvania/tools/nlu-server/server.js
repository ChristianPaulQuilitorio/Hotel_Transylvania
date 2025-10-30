const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { NlpManager } = require('node-nlp');

const PORT = process.env.PORT || 9001;
const MODEL_PATH = process.env.MODEL_PATH || path.join(__dirname, '..', 'nlu', 'model.nlp');

async function loadManager() {
  const manager = new NlpManager({ languages: ['en'], forceNER: true });
  try {
    manager.load(MODEL_PATH);
    console.log('Loaded NLU model from', MODEL_PATH);
  } catch (err) {
    console.warn('Could not load model at', MODEL_PATH, err.message || err);
  }
  return manager;
}

async function main() {
  const app = express();
  app.use(bodyParser.json());

  const manager = await loadManager();

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.post('/classify', async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: 'text required' });
      if (!manager) return res.status(500).json({ error: 'NLU manager not loaded' });
      const r = await manager.process('en', text);
      // node-nlp returns { intent, score, classifications }
      const intent = r.intent || (r.classifications && r.classifications[0]?.label) || 'none';
      const score = typeof r.score === 'number' ? r.score : (r.classifications && r.classifications[0]?.value) || 0;
      return res.json({ intent, score, raw: r });
    } catch (err) {
      console.error('classify error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.listen(PORT, () => console.log(`NLU server listening on port ${PORT} — model: ${MODEL_PATH}`));
}

main().catch(err => { console.error(err); process.exit(1); });
