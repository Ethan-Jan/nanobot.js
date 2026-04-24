/**
 * Playwright：打开页面并等待某条件（骨架，按需修改）
 *
 * 本仓库根已含 dev 依赖 playwright；浏览器内核需在本机装一次：
 *   pnpm run playwright:install
 * 运行（在仓库根）:
 *   node skills/browser-watch/examples/playwright-watch-skeleton.mjs
 */
import { chromium } from "playwright";

const startUrl = process.env.START_URL || "https://example.com/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(startUrl, { waitUntil: "domcontentloaded" });

// 示例：等某个选择器出现（改成你的页面）
// await page.waitForSelector("text=Success", { timeout: 120_000 });

// 示例：在页面里轮询比较某段文字是否变化
const snippet = await page.evaluate(() => {
  return document.body?.innerText?.slice(0, 500) ?? "";
});
console.log("body snippet len", snippet.length, snippet.slice(0, 200));

await browser.close();
