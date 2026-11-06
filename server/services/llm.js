const env = require('../config/env');
const { HttpError } = require('../middleware/errors');

// Thin client for any OpenAI-compatible chat API (Groq by default).

const MAX_RETRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(body) {
  if (!env.llm.apiKey) throw new HttpError(503, 'The AI is not set up yet. Add GROQ_API_KEY to the .env file.');

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${env.llm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.llm.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(env.llm.timeoutMs),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError') throw new HttpError(504, 'The AI took too long to answer. Please try again.');
      console.error(`LLM request failed: ${err?.message}`);
      throw new HttpError(502, "Couldn't reach the AI service. Please try again in a moment.");
    }

    // The free tier allows a limited number of tokens per minute; wait and try again.
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = Math.min(Number(res.headers.get('retry-after')) || 10, 30);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 429) throw new HttpError(429, 'The AI is busy (free usage limit). Please wait a minute and try again.');
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Strict JSON mode now and then produces an answer that fails validation; a second try almost always works.
      if (res.status === 400 && detail.includes('json_validate_failed') && attempt < MAX_RETRIES) continue;
      console.error(`LLM error ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpError(502, 'The AI service returned an error. Please try again.');
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

// gpt-oss models think before answering, and those hidden tokens count toward the free per-minute limit.
// "low" uses about a third of the thinking tokens; save "medium" for steps that need careful judgement.

/** Asks for JSON that matches a JSON Schema and returns the parsed object. */
async function json({ system, user, schema, name = 'result', smart = false, effort = 'low' }) {
  const content = await call({
    model: smart ? env.llm.smartModel : env.llm.fastModel,
    temperature: 0,
    reasoning_effort: effort,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
  });
  try {
    return JSON.parse(content);
  } catch {
    throw new HttpError(502, 'The AI returned an answer that could not be read. Please try again.');
  }
}

/** Free-form text, used for writing (cover letters). */
async function text({ system, user, smart = true, temperature = 0.4, effort = 'low' }) {
  const content = await call({
    model: smart ? env.llm.smartModel : env.llm.fastModel,
    temperature,
    reasoning_effort: effort,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return content.trim();
}

/** Lightweight check used by the UI to show whether AI features are available. */
function status() {
  return env.llm.apiKey
    ? { available: true, models: { fast: env.llm.fastModel, smart: env.llm.smartModel } }
    : { available: false, reason: 'Add GROQ_API_KEY to the .env file to turn on AI features.' };
}

module.exports = { json, text, status };
