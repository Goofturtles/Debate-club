// Model registry. Add or remove entries to expand the showdown.

export const models = {
  // ── Recommended: free, works on EVERY phone (cheapest live Gemini Flash) ──
  // gemini-2.5-flash-lite is the cheapest model still alive (2.0-flash-lite and
  // 1.5-flash-8b were shut down). Free tier: 15 req/min, 1000/day, no card.
  "gemini-2-5-flash-lite": {
    provider: "google",
    model: "gemini-2.5-flash-lite",
    label: "Gemini",
    tier: "free"
  },
  // ── No key, no download, no GPU — the built-in rule-based Roast Engine ──
  // (id kept as -webllm for back-compat with saved selections; it now routes to
  // streamRoastEngine, not WebLLM, because a phone-sized LLM produced nonsense.)
  "on-device-webllm": {
    provider: "webllm",
    model: "roast-engine",
    label: "On-Device",
    tier: "no key"
  },
  "gemini-2-5-flash": {
    provider: "google",
    model: "gemini-2.5-flash",
    label: "Gemini",
    tier: "fast"
  },
  "gemini-2-5-pro": {
    provider: "google",
    model: "gemini-2.5-pro",
    label: "Gemini",
    tier: "smart"
  },
  "claude-haiku-4-5": {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    label: "Claude",
    tier: "fast"
  },
  "claude-sonnet-4-5": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    label: "Claude",
    tier: "smart"
  },
  "gpt-4o-mini": {
    provider: "openai",
    model: "gpt-4o-mini",
    label: "GPT",
    tier: "fast"
  },
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    label: "GPT",
    tier: "smart"
  },
  // Chrome's built-in Gemini Nano (desktop Chrome 138+ with the Prompt API flag).
  "on-device": {
    provider: "browser",
    model: "gemini-nano",
    label: "Chrome AI",
    tier: "device"
  }
};

export const providers = {
  google: {
    name: "Google",
    label: "Gemini",
    color: "#4285f4",
    keyHelpUrl: "https://aistudio.google.com/apikey",
    envVar: "GOOGLE_API_KEY",
    free: true,          // genuinely free tier, no credit card — works on phones
    recommended: true    // the easiest path that works on every device
  },
  webllm: {
    name: "On-Device",
    label: "On-Device",
    color: "#a78bfa",    // soft violet — no key, runs locally
    keyHelpUrl: null,
    envVar: null,
    keyless: true,       // no API key — runs entirely in the browser (WebGPU)
    inBrowser: true
  },
  anthropic: {
    name: "Anthropic",
    label: "Claude",
    color: "#d97757",
    keyHelpUrl: "https://console.anthropic.com/",
    envVar: "ANTHROPIC_API_KEY"
  },
  openai: {
    name: "OpenAI",
    label: "GPT",
    color: "#10a37f",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY"
  },
  browser: {
    name: "Chrome",
    label: "Chrome AI",
    color: "#c084fc",        // brighter violet — distinct from the WebGPU on-device option
    keyHelpUrl: "https://developer.chrome.com/docs/ai/prompt-api",
    envVar: null,            // no API key — runs entirely on-device
    onDevice: true
  }
};
