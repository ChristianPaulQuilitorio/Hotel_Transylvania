// Supabase Edge Function (Deno) - chatbot POC
// Deploy this under supabase/functions/chatbot (Supabase CLI) or adapt to your server.
// Behavior:
// 1) Perform lightweight intent detection via regex for common commands.
// 2) If an intent is matched, return a concise structured reply (no LLM call).
// 3) Otherwise, forward the conversation to OpenAI Chat Completion and return its reply.

// Note: This file expects an env var OPENAI_API_KEY to be set in the Function's environment.

interface ChatMsg { role: string; content: string }

const SYSTEM_PROMPT = `You are BookSmart's assistant 'Drac'. Answer concisely, obey constraints and only act on things the app can perform. If you cannot help, respond exactly: "AI can’t solve that, please contact our key personnel."`;

function detectIntent(text: string) {
  const q = text.toLowerCase();
  // language hints (very small heuristic)
  if (/\b(hola|gracias|por favor|reservar|habitaci[oó]n)\b/.test(q)) return { intent: 'fallback', lang: 'es' };
  if (/\b(bonjour|merci|s'il vous pla[iî]t|r[eé]server)\b/.test(q)) return { intent: 'fallback', lang: 'fr' };

  if (/\b(book|reserve|booking|i want to book|how do i book|avail)\b/.test(q)) return { intent: 'book' };
  if (/\b(cancel|cancel my booking|how do i cancel)\b/.test(q)) return { intent: 'cancel' };
  if (/\b(available rooms|rooms available|which rooms are free|is room)\b/.test(q)) return { intent: 'availability' };
  if (/\b(list rooms|what rooms|amenities|what'?s included)\b/.test(q)) return { intent: 'list_rooms' };
  if (/\b(hi|hello|hey|good morning|good afternoon|good evening|hola|bonjour)\b/.test(q)) return { intent: 'greeting' };
  return { intent: 'unknown' };
}

async function callOpenAI(messages: ChatMsg[]) {
  const key = Deno.env.get('OPENAI_API_KEY') || '';
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.2,
    max_tokens: 512,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${t}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? null;
  return content;
}

export default async function (req: Request) {
  try {
    const j = await req.json().catch(() => ({}));
    const messages: ChatMsg[] = Array.isArray(j?.messages) ? j.messages : [];
    const lastUser = [...messages].reverse().find((m: ChatMsg) => m.role === 'user')?.content || '';

    // 1) Try NLU microservice if configured (preferred for trained, multilingual intents)
    let n = { intent: 'unknown' as string, confidence: 0 };
    try {
      const nluUrl = Deno.env.get('NLU_URL');
      if (nluUrl) {
        const resp = await fetch(nluUrl.replace(/\/$/, '') + '/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lastUser || '' })
        });
        if (resp.ok) {
          const j = await resp.json();
          if (j?.intent) {
            n = { intent: j.intent, confidence: j.score ?? j.value ?? 0 } as any;
          }
        }
      } else {
        // fallback to simple regex-based detection below
        n = detectIntent(lastUser || '');
      }
    } catch (err) {
      // If microservice call fails, continue with regex NLU
      console.warn('NLU service call failed, falling back to regex NLU', err);
      n = detectIntent(lastUser || '');
    }
    // If NLU reports a high-confidence structured intent, answer with the
    // appropriate action. We consider confidence >= 0.7 as high.
    const CONF_THRESH = 0.7;
    const intentName = (n as any).intent;
    const intentConf = (n as any).confidence ?? 0;
    if (intentName === 'book' && intentConf >= CONF_THRESH) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'To book a room: open Dashboard, choose a room, select check-in date and days (1–5), then click Avail to confirm.' } }), { headers: { 'content-type': 'application/json' } });
    }
    if (intentName === 'cancel' && intentConf >= CONF_THRESH) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'To cancel a booking: open the room you booked and click Cancel booking. Only the person who booked can cancel.' } }), { headers: { 'content-type': 'application/json' } });
    }
    if (intentName === 'availability' && intentConf >= CONF_THRESH) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'To check availability for a specific date, ask like: "Is room 2 available on 2025-11-03?" or ask "Which rooms are available tomorrow?"' } }), { headers: { 'content-type': 'application/json' } });
    }
    if (intentName === 'list_rooms' && intentConf >= CONF_THRESH) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'We offer Deluxe King, Twin Suite, Family Room, Queen Standard, and Executive Suite. You can view details and amenities from the Dashboard.' } }), { headers: { 'content-type': 'application/json' } });
    }
    if (intentName === 'greeting' && intentConf >= CONF_THRESH) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: "Hello! I'm Drac. I can help with bookings, availability, and account questions." } }), { headers: { 'content-type': 'application/json' } });
    }

    // 2) Fallback to OpenAI for unknown or free-form queries
    try {
      const ai = await callOpenAI(messages as ChatMsg[]);
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: ai } }), { headers: { 'content-type': 'application/json' } });
    } catch (err) {
      console.error('OpenAI fallback failed', err);
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: "AI can’t solve that, please contact our key personnel." } }), { headers: { 'content-type': 'application/json' } });
    }
  } catch (err) {
    console.error('chatbot function error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
// @ts-nocheck
// Supabase Edge Function: chatbot
// Deploy via: supabase functions deploy chatbot
// Requires secret OPENAI_API_KEY set with: supabase secrets set OPENAI_API_KEY="..."
// deno-lint-ignore-file no-explicit-any
import OpenAI from "https://deno.land/x/openai@v4.55.4/mod.ts";

// Simple in-memory rate limiter (best-effort per function instance)
const buckets = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count += 1;
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
    const rateKey = ip;
    if (isRateLimited(rateKey)) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'AI can’t solve that, please contact our key personnel.' } }), {
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
        status: 429,
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

    const { messages } = await req.json();

    // Guardrail: enforce our fallback behavior if input is empty or malformed
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'AI can’t solve that, please contact our key personnel.' } }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new OpenAI({ apiKey });

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    });

    const reply = resp.choices?.[0]?.message ?? { role: "assistant", content: "AI can’t solve that, please contact our key personnel." };

    // If model returned nothing sensible, return the mandated fallback.
    if (!reply?.content || typeof reply.content !== 'string') {
      return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'AI can’t solve that, please contact our key personnel.' } }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Soft guard: if the model says it's unsure, normalize to our fallback phrase
    const lc = reply.content.toLowerCase();
    const unsure = lc.includes("don\'t know") || lc.includes("not sure") || lc.includes("can\'t answer");
    const content = unsure ? 'AI can’t solve that, please contact our key personnel.' : reply.content;

    return new Response(JSON.stringify({ reply: { role: reply.role ?? 'assistant', content } }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ reply: { role: 'assistant', content: 'AI can’t solve that, please contact our key personnel.' } }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
});
