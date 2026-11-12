// SmartEdu AI Tutor serveri. Node.js 18+ kerak, tashqi paketlar shart emas.
//
// Ishga tushirish:
//   export ANTHROPIC_API_KEY="sk-ant-..."
//   node server.js
// Keyin brauzerda http://localhost:3000 ni oching.
//
// API kalit faqat shu serverda turadi. Uni hech qachon index.html ichiga yozmang.

const http = require("http");
const fs = require("fs");
const path = require("path");

const KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT  3000;
const MODEL = process.env.TUTOR_MODEL  "claude-sonnet-5-5";
const MAX_BODY = 100 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

http
  .createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/tutor") {
      if (!KEY)
        return send(res, 503, { error: "ANTHROPIC_API_KEY sozlanmagan" });
      try {
        const data = JSON.parse(await readBody(req));
        const system = String(data.system  "").slice(0, 8000);
        let messages = (Array.isArray(data.messages) ? data.messages : [])
          .filter(
            (m) =>
              m &&
              (m.role === "user"  m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim(),
          )
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        while (messages.length && messages[0].role !== "user") messages.shift();
        if (!messages.length  messages[messages.length - 1].role !== "user")
          return send(res, 400, { error: "xabarlar noto‘g‘ri" });

        const body = { model: MODEL, max_tokens: 800, messages };
        if (system) body.system = system;
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok)
          return send(res, 502, {
            error: (j && j.error && j.error.message)  "AI xatosi",
          });
        const text = (j.content  [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return send(res, 200, { text });
      } catch (e) {
        return send(res, 400, { error: String(e.message  e) });
      }
    }
    if (
      req.method === "GET" &&
      (req.url === "/" || req.url === "/index.html")
    ) {
      return fs.readFile(path.join(__dirname, "index.html"), (err, buf) => {
        if (err) {
          res.writeHead(500);
          return res.end("index.html topilmadi");
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(buf);
      });
    }
    res.writeHead(404);
    res.end("Topilmadi");
  })
  .listen(PORT, () =>
    console.log(
      "SmartEdu: http://localhost:" +
        PORT +
        (KEY ? "" : "  (ANTHROPIC_API_KEY yo‘q: AI oflayn rejimda)"),
    ),
  );