import puppeteer from "puppeteer-core";

const EXE = "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi";
const URL = "http://localhost:5190/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1000,800"],
  defaultViewport: { width: 1000, height: 800 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

for (let i = 0; i < 40; i++) {
  if (await page.$("#xp-password")) break;
  await sleep(500);
}
console.log("LOGIN FIELD:", !!(await page.$("#xp-password")));
if (await page.$("#xp-password")) {
  await page.type("#xp-password", "4747");
  await sleep(200);
  await page.keyboard.press("Enter");
}
for (let i = 0; i < 60; i++) {
  if ((await page.evaluate(() => document.querySelectorAll("#wenge-virtual-screen").length)) > 0) break;
  await sleep(600);
}
await sleep(800);

async function getIcons() {
  return await page.evaluate(() => {
    const vs = document.getElementById("wenge-virtual-screen");
    if (!vs) return { results: [] };
    const results = [];
    const seen = new Set();
    Array.prototype.forEach.call(vs.querySelectorAll("[data-icon]"), (icon) => {
      const img = icon.querySelector("img");
      const src = img && img.src.split("/").pop();
      if (!src || seen.has(src)) return;
      seen.add(src);
      const r = icon.getBoundingClientRect();
      results.push({ src, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
    });
    return { results };
  });
}

const { results: icons } = await getIcons();
console.log("ICONS:", icons.map((i) => i.src).join(","));
if (icons.length === 0) {
  const dbg = await page.evaluate(() => ({
    vs: !!document.getElementById("wenge-virtual-screen"),
    imgs: Array.prototype.slice.call(document.querySelectorAll("img")).map((i) => i.src).join(","),
    bodyText: (document.body.innerText || "").slice(0, 200),
  }));
  console.log("DBG:", JSON.stringify(dbg));
  await browser.close(); process.exit(0);
}

const mc = icons.find((i) => i.src === "my_computer.png") || icons[0];
const menuCount = async () => (await page.$$("div[data-context-menu]")).length;

// fresh helper: reopen by right-clicking the icon
const openMenu = async () => {
  // close any lingering menu by clicking empty desktop first
  await page.mouse.click(950, 600);
  await sleep(150);
  await page.mouse.click(mc.cx, mc.cy, { button: "right" });
  await sleep(300);
};

// --- Test 1: right-click icon, then left-click a DIFFERENT icon ---
await openMenu();
console.log("1) MENU after right-click:", await menuCount());
const other = icons.find((i) => i.src === "explorer.png");
console.log("MC:", JSON.stringify(mc), "OTHER:", JSON.stringify(other));
if (other) {
  await page.mouse.click(other.cx, other.cy);
  await sleep(600);
  const dbg = await page.evaluate(() => {
    const menus = Array.prototype.slice.call(document.querySelectorAll("div[data-context-menu]"));
    return menus.map((m) => ({ style: m.getAttribute("style"), text: (m.innerText || "").replace(/\n/g, "|") }));
  });
  console.log("1) MENU after left-click OTHER icon:", await menuCount(), "DBG:", JSON.stringify(dbg));
}

// --- Test 2: right-click icon, then left-click empty desktop ---
await openMenu();
console.log("2) MENU after right-click:", await menuCount());
await page.mouse.click(900, 650);
await sleep(600);
console.log("2) MENU after left-click empty desktop:", await menuCount());

// --- Test 3: right-click icon, then click "Open" in menu ---
await openMenu();
console.log("3) MENU after right-click:", await menuCount());
const openPos = await page.evaluate(() => {
  const el = document.querySelector("div[data-context-menu] li");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (openPos) { await page.mouse.click(openPos.x, openPos.y); await sleep(600); }
console.log("3) MENU after clicking Open:", await menuCount(), "WIN:", await page.evaluate(() => document.querySelectorAll("[data-window]").length));

await browser.close();
process.exit(0);