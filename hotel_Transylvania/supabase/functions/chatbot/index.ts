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
