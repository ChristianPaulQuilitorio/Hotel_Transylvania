NLU Training & Multilingual Guide
================================

This project includes a simple training pipeline to bootstrap intent classification
for the chatbot. The approach is intentionally pragmatic:

- Use a small supervised intent dataset (see `supabase/functions/chatbot/training/intents.json`).
- Optionally augment the dataset with translations to cover many languages.
- Train a local NLU model (node-nlp) and persist the artifact.
- Host the trained model in a small Node-based NLU microservice and have the
  chatbot function call it for fast intent classification.

Files added
----------
- `supabase/functions/chatbot/training/intents.json`: base English examples for intents.
- `tools/train_nlu.js`: trains a node-nlp model and saves `tools/nlu/model.nlp`.
- `tools/translate_augment.js`: optional script to generate translated examples using OpenAI (server-side).
- `supabase/functions/chatbot/index.ts`: Edge Function POC (regex NLU + OpenAI fallback).

Quick start (local)
-------------------
1. Install Node deps for training locally:

   npm init -y
   npm install node-nlp node-fetch@2

2. (Optional) Create `.env` with OPENAI_API_KEY if you want to generate translations.

3. Generate multilingual dataset (optional):

   node tools/translate_augment.js

4. Train the nlu model:

   node tools/train_nlu.js

5. The trained model will be at `tools/nlu/model.nlp`. Host a tiny Node server
   that loads this file and exposes an endpoint `/classify` which accepts JSON
   { text: '...' } and returns the predicted intent and score.

Integration with Supabase Edge Function
--------------------------------------
There are two patterns:

A) Keep the Edge Function and call the NLU microservice from it. Flow:
   Chat message -> Supabase Edge Function -> call NLU microservice -> if
   high-confidence structured intent, act; else call OpenAI fallback.

B) Replace Edge Function logic with the NLU microservice (Node) and call it
   directly from the Angular client via your secure backend. Prefer server-side
   routing to keep API keys secret.

Next improvements
-----------------
- Collect real user utterances (logs in `chat_logs`) and add them to the training
  set periodically to improve accuracy.
- Add intent confidence thresholding and a human-in-the-loop review UI.
- Consider deploying a production-grade NLU (Rasa) if you need dialog
  management, multi-turn state, and more robust slot-filling across languages.
