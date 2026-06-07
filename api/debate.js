import { personas } from "../personas.js";
import { models, providers } from "../models.js";

export const config = { runtime: "edge" };

const MAX_TOKENS = 40;            // ONE short, intense line. Hard cap on length.
const DAILY_LIMIT = 150;

// !!! KEEP IN SYNC with the duplicate BATTLE_RULES in index.html !!!
// The on-device (Chrome AI) path skips this file entirely and builds prompts
// client-side, so any change here MUST also be applied to index.html or
// on-device and cloud personas will drift.
const BATTLE_RULES =
  "\n\nYou are in a LIVE TEXT ROAST DEBATE. Two rivals, ONE topic, a SCREAMING crowd. Absolute max intensity.\n" +
  "RULES — obey exactly:\n" +
  "- ONE SHORT SENTENCE. Max 15 words. If you write a second sentence, you LOSE. No exceptions, ever.\n" +
  "- BE BRUTAL. Go straight for the throat — merciless, savage, no mercy. Humiliate them. Every line is a knockout.\n" +
  "- ROAST your opponent AND prove your point in the SAME breath — mock their exact words while arguing the topic.\n" +
  "- ANYONE should instantly get the burn. No big words, no obscure references, no nerdy inside jokes. Clever but CLEAR.\n" +
  "- Stay on THE TOPIC — never a generic insult that could fit any debate.\n" +
  "- Talk like a real person absolutely going OFF in the group chat. Funny and savage.\n" +
  "- Emojis encouraged, especially trending ones (💀 😭 🔥 💯 🤡 🫡 🥀). One or two.\n" +
  "- For emphasis put ONE word in *italics* or **bold**. Never wrap the whole line.\n" +
  "- A GIF is OPTIONAL and rare. Only when it truly lands: end with [gif: search] that matches your line.\n" +
  "Perfect example: Pineapple on pizza? Even your dog would walk away from that plate 💀";

export default async function handler(request) {
  if (request.method !== "POST") {
    return jsonError(405, "POST required");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid JSON body");
  }

  const {
    topic,
    persona_id: personaId,
    model_id: modelId,
    api_key: userApiKey,
    system: clientSystem,   // fully-assembled prompt from the client (persona+rules+stance+vibe)
    history = []
  } = body ?? {};

  if (!topic || !personaId || !modelId) {
    return jsonError(400, "topic, persona_id, and model_id required");
  }
  const persona = personas[personaId];
  if (!persona) return jsonError(400, `unknown persona: ${personaId}`);
  const modelDef = models[modelId];
  if (!modelDef) return jsonError(400, `unknown model: ${modelId}`);
  const providerDef = providers[modelDef.provider];
  if (!providerDef) return jsonError(400, `unknown provider: ${modelDef.provider}`);

  // Resolve the API key: user-provided wins; otherwise fall back to server env.
  const apiKey = (userApiKey && userApiKey.trim())
    || process.env[providerDef.envVar];
  if (!apiKey) {
    return jsonError(
      400,
      `No ${providerDef.name} API key. Add one via Settings, or set ${providerDef.envVar} on the server.`
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = await checkRateLimit(ip);
  if (!limit.allowed) {
    return jsonError(429, `daily limit of ${DAILY_LIMIT} turns reached`);
  }

  // Build the alternating user/assistant message history from this persona's POV.
  // Opponent turns become "user" messages; the synthetic "__user__" id is the
  // human challenger in You-vs-AI roast mode.
  const messages = [];
  for (const turn of history) {
    if (!turn?.persona_id || typeof turn.content !== "string") continue;
    if (turn.persona_id === personaId) {
      messages.push({ role: "assistant", content: turn.content });
    } else {
      const opp = turn.persona_id === "__user__"
        ? "Challenger"
        : (personas[turn.persona_id]?.name ?? "Your opponent");
      messages.push({ role: "user", content: `${opp}: "${turn.content}"` });
    }
  }

  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: `THE TOPIC: "${topic}"\n\nPick your side of this and open with one savage line that argues it. Stay on the topic.`
    });
  } else if (messages[messages.length - 1].role === "assistant") {
    messages.push({
      role: "user",
      content: "Your opponent went quiet. Hit them again — one line, still about the topic."
    });
  } else {
    const last = messages[messages.length - 1];
    last.content = last.content + "\n\nClap back about the topic. One line. Stay in character.";
  }

  // Prefer the client-assembled system prompt (carries stance + vibe). Fall back
  // to building it here if an older/other client doesn't send one.
  const systemPrompt = (typeof clientSystem === "string" && clientSystem.trim())
    ? clientSystem
    : persona.system_prompt + BATTLE_RULES;

  try {
    const stream = await callProvider(
      modelDef.provider,
      modelDef.model,
      systemPrompt,
      messages,
      apiKey
    );
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive"
      }
    });
  } catch (err) {
    return jsonError(502, String(err.message ?? err));
  }
}

// ─── Provider dispatch ───────────────────────────────────────────────

async function callProvider(provider, model, systemPrompt, messages, apiKey) {
  switch (provider) {
    case "anthropic": return callAnthropic(model, systemPrompt, messages, apiKey);
    case "openai":    return callOpenAI(model, systemPrompt, messages, apiKey);
    case "google":    return callGoogle(model, systemPrompt, messages, apiKey);
    default: throw new Error(`unsupported provider: ${provider}`);
  }
}

async function callAnthropic(model, systemPrompt, messages, apiKey) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      stream: true
    })
  });
  await checkProviderResponse(resp, "Claude", model);
  return transformSSE(resp.body, (data) => {
    if (data.type === "content_block_delta" && data.delta?.text) return data.delta.text;
    return null;
  });
}

async function callOpenAI(model, systemPrompt, messages, apiKey) {
  const openaiMessages = [{ role: "system", content: systemPrompt }, ...messages];
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: openaiMessages,
      stream: true
    })
  });
  await checkProviderResponse(resp, "GPT", model);
  return transformSSE(resp.body, (data) => {
    if (data?.choices?.[0]?.delta?.content) return data.choices[0].delta.content;
    return null;
  });
}

async function callGoogle(model, systemPrompt, messages, apiKey) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    `:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: MAX_TOKENS }
    })
  });
  await checkProviderResponse(resp, "Gemini", model);
  return transformSSE(resp.body, (data) => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (parts && parts[0]?.text) return parts[0].text;
    return null;
  });
}

// Read the upstream provider's error body fully, parse JSON if possible,
// and throw a clean, actionable Error. Never returns truncated JSON.
async function checkProviderResponse(resp, providerLabel, modelName) {
  if (resp.ok) return;
  const bodyText = await resp.text();
  let message = "";
  try {
    const parsed = JSON.parse(bodyText);
    message =
      parsed?.error?.message ||
      parsed?.error?.error?.message ||
      parsed?.message ||
      "";
    // OpenAI sometimes nests differently
    if (!message && Array.isArray(parsed?.error)) {
      message = parsed.error[0]?.message || "";
    }
  } catch {
    // not JSON — keep raw
  }
  if (!message) {
    message = bodyText.slice(0, 300).trim() || `HTTP ${resp.status}`;
  }
  // Map common status codes to friendlier hints
  let hint = "";
  if (resp.status === 401) hint = " Check your API key in Settings.";
  else if (resp.status === 403) hint = " Your key doesn't have access to this model.";
  else if (resp.status === 404 && /not found/i.test(message)) {
    hint = ` Edit models.js to use a model that exists in your account.`;
  } else if (resp.status === 429) hint = " Rate-limited — wait a moment or check your plan.";
  else if (resp.status === 400 && /credit|balance|quota/i.test(message)) {
    hint = " Top up your account or switch to a different provider.";
  }
  throw new Error(`${providerLabel} (${modelName}) — ${message}${hint}`);
}

// ─── Generic SSE → {text} transformer ────────────────────────────────

function transformSSE(upstreamBody, deltaParser) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const text = deltaParser(parsed);
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    }
  });
}

// ─── Rate limit (optional Upstash) ───────────────────────────────────

async function checkRateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: true };
  const day = new Date().toISOString().slice(0, 10);
  const key = `ratelimit:${ip}:${day}`;
  const incr = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { result } = await incr.json();
  if (result === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/86400`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return { allowed: result <= DAILY_LIMIT, count: result };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" }
  });
}
