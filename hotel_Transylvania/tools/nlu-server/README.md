NLU Microservice
=================

This small Express server loads a `node-nlp` model and exposes a `/classify`
endpoint for intent classification.

Quick start
-----------
1. Install deps:

   npm install

2. Ensure you have a trained model at `tools/nlu/model.nlp`. Use `tools/train_nlu.js` to create it.

3. Start the server:

   npm start

4. Health check:

   curl http://localhost:9001/health

5. Classify example:

   curl -X POST http://localhost:9001/classify -H "Content-Type: application/json" -d '{"text":"I want to book a room"}'

Environment
-----------
- `PORT` (default 9001)
- `MODEL_PATH` (default `./tools/nlu/model.nlp`)

Notes
-----
- This microservice is optional. If you deploy it, set `NLU_URL` env var in
  your Supabase Function (or deploy the function in an environment that can
  reach the microservice). The Supabase Edge Function will call the microservice
  for trained, multilingual intent detection.
