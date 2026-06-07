// Model registry. Add or remove entries to expand the showdown.

export const models = {
  // On-device / no-key option first so it's the default for new visitors
  "on-device": {
    provider: "browser",
    model: "gemini-nano",
    label: "Chrome AI",
    tier: "device"
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
  }
};

export const providers = {
  browser: {
    name: "Chrome",
    label: "Chrome AI",
    color: "#a78bfa",        // soft violet — distinct from cloud providers
    keyHelpUrl: "https://developer.chrome.com/docs/ai/prompt-api",
    envVar: null,            // no API key — runs entirely on-device
    onDevice: true
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
  google: {
    name: "Google",
    label: "Gemini",
    color: "#4285f4",
    keyHelpUrl: "https://aistudio.google.com/apikey",
    envVar: "GOOGLE_API_KEY"
  }
};
