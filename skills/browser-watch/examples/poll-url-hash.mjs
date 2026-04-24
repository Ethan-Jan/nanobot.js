/**
 * 轻量「页面/接口是否变化」监听（无需 Playwright / 无额外 npm 包）
 * 用法（仓库根）: node skills/browser-watch/examples/poll-url-hash.mjs
 * 可改 URL、轮询间隔；变化时只 console.log，可自行改成发通知
 */
import crypto from "node:crypto";

const url = process.env.WATCH_URL || "https://example.com/";
const intervalMs = Number(process.env.POLL_MS || 60_000);

let lastHash = "";

function hash(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

async function once() {
  const res = await fetch(url, {
    headers: { "user-agent": "nanobot-browser-watch/1.0" },
  });
  const text = await res.text();
  const h = hash(text);
  if (!lastHash) {
    lastHash = h;
    console.log(new Date().toISOString(), "baseline", h.slice(0, 12), "…");
    return;
  }
  if (h !== lastHash) {
    console.log(new Date().toISOString(), "CHANGED", h.slice(0, 12), "…");
    lastHash = h;
  } else {
    console.log(new Date().toISOString(), "no change");
  }
}

console.log("polling", url, "every", intervalMs, "ms");
setInterval(() => {
  once().catch((e) => console.error(e));
}, intervalMs);
void once();
