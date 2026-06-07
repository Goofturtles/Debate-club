# Debate Club

Two AIs roast each other in a live text battle. You judge.

Pick two characters (Sherlock, Joe Rogan, a Stoic, a 90s infomercial salesman),
pick which AI model powers each side (Claude, GPT, or Gemini), type a topic, and
watch them argue back and forth like an iMessage thread. Up to 10 turns. STOP
whenever. Then crown a winner.

Apple-style design (Liquid Glass, SF Pro, Apple blue accent, pill buttons,
custom Apple-style model picker with provider color dots).

**Pacing:** Each turn shows a typing indicator for ~1 second before the message
starts arriving, then text streams in at iMessage speed (not instant). Messages
are capped at 1–2 short sentences — real text-message length, not paragraphs.

**GIFs:** Personas can drop in a reaction GIF by writing `[gif: search query]`.
The frontend fetches a matching GIF from Tenor using your Google API key (the
same one you use for Gemini — set it once in Settings, GIFs work everywhere).
No Google key? GIFs gracefully degrade to inline text placeholders.

## Quick start

```bash
cd ai-debate
npm run dev:nofile        # http://localhost:3470/
```

Then open the site, click **⚙ API Key Settings**, paste in your Anthropic /
OpenAI / Google key (any combination — you only need keys for the providers
you want to use), and battle. Keys live in your browser's `localStorage` and
are sent only to the AI provider you select.

If you'd rather use a `.env` for personal use, copy `.env.example` to `.env`
and set any of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`. Server
env vars are used as fallback when the browser hasn't entered a key. Then run
`npm run dev` (note: `dev` requires the `.env` file to exist; `dev:nofile`
skips that requirement and reads only from process env or browser keys).

## Models supported

Edit `models.js` to add or remove.

| Provider | Model |
| -------- | ----- |
| Anthropic | Claude Haiku 4.5, Claude Sonnet 4.6 |
| OpenAI | GPT-4o mini, GPT-4o |
| Google | Gemini 2.0 Flash, Gemini 1.5 Pro |

Each persona can run on any model independently. Sherlock-as-Claude vs
Rogan-as-GPT is a real, working matchup. Watch them roast each other in
different voices on top of different underlying models.

## Deploy to Vercel

1. `git init && git add . && git commit -m "initial"`
2. Push to a fresh GitHub repo.
3. Import at <https://vercel.com/new>. Vercel auto-detects the Edge function
   in `api/debate.js`. No build settings needed.
4. (Optional) In **Project Settings → Environment Variables**, set any of
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` if you want the
   server to provide default keys to visitors who haven't entered their own.
5. (Optional) Add Upstash Redis (one-click) for rate limiting (80 turns per
   IP per day). Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
6. Share the URL.

## File layout

```
ai-debate/
├── api/debate.js        Edge function — multi-provider router (Anthropic/OpenAI/Google), streams SSE
├── personas.js          Persona registry (name, avatar, color, voice prompt)
├── models.js            Model & provider registry
├── index.html           iMessage-style chat UI + Settings modal
├── dev-server.js        Local Node server (wraps the Edge handler)
├── package.json         ES module + dev script
├── .env.example         Env var template (all optional)
└── .gitignore
```

## How a battle works

1. Pick personas and models for each side. Each side reads its model's
   provider, looks up the key (browser localStorage first, then server env).
2. Click **Begin Battle**. The frontend POSTs to `/api/debate` with
   `{topic, persona_id, model_id, api_key, history: []}`.
3. The Edge function looks up `models[model_id]` → provider, dispatches to
   `callAnthropic` / `callOpenAI` / `callGoogle`, and streams the result back
   as a unified SSE format (`data: {"text": "..."}`).
4. Bubble fills as text streams. When complete, the frontend appends the turn
   to local history and POSTs the next turn for the other side, with the full
   history attached. The backend transforms history into alternating
   user/assistant messages from each persona's POV.
5. Loop until 10 turns OR user hits **Stop the battle**.
6. After the battle, two pill verdict buttons appear → user crowns winner.

## API key handling

- **Browser**: stored in `localStorage` under `aidebate.key.{provider}`.
  Never sent anywhere except to the AI provider via the proxy.
- **Proxy**: receives the key in the POST body, forwards it as the
  provider-appropriate auth header (`x-api-key`, `Authorization: Bearer`,
  or `?key=`). Not logged. Not stored. The request is the only place it lives.
- **Server env fallback**: if the browser didn't send a key, the proxy falls
  back to the matching `*_API_KEY` env var. Useful for personal local dev or
  when you want to subsidize friends' usage on your own deploy.

## Adding a persona

Edit `personas.js`:

```js
new_persona_id: {
  name: "Display Name",
  avatar: "🎭",
  color: "#hexcode",
  system_prompt: "You are ... Voice: ..."
}
```

Battle rules (length cap, roast permission, react-to-opponent) are added by
the Edge function as a shared suffix — don't repeat them per persona.

## Adding a model

Edit `models.js`:

```js
"my-model-id": {
  provider: "anthropic",                  // or "openai" / "google"
  model: "claude-something-actual-name",  // exact API model name
  label: "My Model"                       // shown in dropdown
}
```

## Cost math

Claude Haiku is roughly $1/1M output tokens. With `max_tokens: 180` per turn,
a full 10-turn battle costs ~$0.002 (less than a cent). GPT-4o-mini and
Gemini Flash are comparable. GPT-4o, Claude Sonnet, and Gemini Pro are 10-20×
pricier — pick those only if you want the heavyweight version.

## Roadmap

- **v1 (this)** — multi-turn text battle, persona roster, multi-provider model
  picker, BYO API key.
- **v2** — shareable battle URLs (Upstash hash storage), more personas, user
  custom personas.
- **v3** — game show framing: AI host introduces and announces, in-character
  loser reactions, optional TTS.

Full design doc at `~/.gstack/projects/Website/arjun-ai-debate-design-20260524-204116.md`.
