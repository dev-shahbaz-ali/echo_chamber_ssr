// server.js — project ROOT
// Run: node server.js

require("dotenv").config({ path: ".env.local" });

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initWebSocket } = require("./src/lib/wsManager");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  initWebSocket(server);

  server.listen(3000, () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  http://localhost:3000");
    console.log("  ws://localhost:3000/ws");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
});
