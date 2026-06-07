// Local dev server. Wraps the Edge handler so you can run the app without
// needing the Vercel CLI installed. Run with:
//
//   node --env-file=.env dev-server.js     (if you have a .env)
//   node dev-server.js                     (if relying entirely on browser keys)
//
// Then open http://localhost:3470/

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/debate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3470;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ─── API route ─────────────────────────────────────────────────────
  if (url.pathname === "/api/debate") {
    await handleApi(req, res, url).catch((err) => {
      console.error("[dev-server] api error:", err);
      if (!res.headersSent) {
        try {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: String(err.message ?? err) }));
        } catch { /* ignore — connection probably already closed */ }
      } else {
        try { res.end(); } catch { /* same */ }
      }
    });
    return;
  }

  // ─── Static files ──────────────────────────────────────────────────
  try {
    let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    if (pathname.includes("..")) {
      res.writeHead(400); res.end("Bad path"); return;
    }
    const full = path.join(__dirname, pathname);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not Found");
      return;
    }
    const ext = path.extname(pathname);
    const data = await fs.readFile(full);
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch (err) {
    console.error("[dev-server] static error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error: " + String(err.message ?? err));
    }
  }
});

async function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress ?? "127.0.0.1";

  // Buffer body if present
  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  const fetchReq = new Request(url, {
    method: req.method,
    headers: { ...req.headers, "x-forwarded-for": ip },
    body: body && body.length ? body : undefined,
    duplex: body && body.length ? "half" : undefined
  });

  const response = await handler(fetchReq);

  // Send headers
  const headers = {};
  response.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(response.status, headers);
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  // Pipe body chunks. Any error in the loop is caught and the response
  // is gracefully ended. We never try to writeHead twice.
  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();

  // Detect client disconnect and stop reading the upstream
  let clientClosed = false;
  req.on("close", () => { clientClosed = true; });
  res.on("close", () => { clientClosed = true; });

  try {
    while (true) {
      if (clientClosed) {
        try { await reader.cancel(); } catch {}
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      // res.write returns false if the backpressure buffer is full; that's fine,
      // it still queues. We don't await drain for simplicity.
      const ok = res.write(Buffer.from(value));
      if (!ok && !res.writableEnded) {
        await new Promise((r) => res.once("drain", r));
      }
    }
  } catch (err) {
    console.error("[dev-server] stream error:", err);
    // Body stream broke. Just end the response — headers are already sent.
  } finally {
    try { res.end(); } catch {}
  }
}

server.on("clientError", (err, socket) => {
  // Catches malformed HTTP frames, etc. Don't let these crash the server.
  console.error("[dev-server] client error:", err.message);
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  }
});

server.listen(PORT, () => {
  console.log(`\n  Debate Club dev server: http://localhost:${PORT}/\n`);
  const hasAny =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!hasAny) {
    console.log("  No provider API keys in env. Users will need to enter their own");
    console.log("  via the Settings panel in the browser (which is the recommended");
    console.log("  setup — keys never touch your server).\n");
  }
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.log("  (Upstash not configured — rate limiting disabled.)\n");
  }
});
