/* global window, console, URL */
import { chromium } from "playwright";
import { writeFile, unlink } from "node:fs/promises";
import { gzipSync } from "node:zlib";
await writeFile(
  new URL("../capture.html", import.meta.url),
  "<html><body style=\"margin:0;background:#080f1b\"><canvas id=\"stage\" style=\"width:1280px;height:720px\"></canvas><script type=\"module\">\nimport {createEngine,ConstantClock} from '@clockwyrks/simple-2d';\nimport {game,BACKGROUND} from './src/game.ts';\nwindow.captureEngine=createEngine({canvas:document.getElementById('stage'),width:1280,height:720,game,background:BACKGROUND,layout:'dpad-4',clock:new ConstantClock(1000/60)});\nawait window.captureEngine.initialize();await window.captureEngine.advance(1);window.ready=true;\n</script></body></html>\n",
);
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => {
  throw e;
});
await page.goto("http://localhost:5173/capture.html");
await page.waitForFunction(() => window.ready);
const frames = async (n) =>
  page.evaluate((n) => window.captureEngine.advance(n), n);
const key = async (k, n = 10) => {
  await page.keyboard.press(k);
  await frames(n);
};
await page.screenshot({ path: "showcase/title.png" });
await key("Enter");
await key("Enter");
await page.evaluate(() => window.captureEngine.startRecording());
await frames(60);
async function drag(x, y, X, Y) {
  await page.mouse.move(x, y);
  await frames(10);
  await page.mouse.down();
  await frames(10);
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x + ((X - x) * i) / 12, y + ((Y - y) * i) / 12);
    await frames(5);
  }
  await page.mouse.up();
  await frames(10);
}
await drag(75, 101, 568, 304);
await drag(75, 131, 592, 304 - (48 * Math.sqrt(3)) / 2);
await drag(75, 71, 616, 304);
for (let i = 0; i < 3; i++) await key("q", 15);
await page.mouse.click(324, 574);
await frames(10);
for (const k of ["g", "d", "v", "a"]) await key(k, 30);
await page.screenshot({ path: "showcase/workbench.png" });
await key("Space", 90);
await page.screenshot({ path: "showcase/in-motion.png" });
await frames(410);
await page.screenshot({ path: "showcase/complete.png" });
const snap = await page.evaluate(() =>
  window.captureEngine.debug.snapshot(window.captureEngine.state),
);
console.log(snap.sim?.status, snap.sim?.metrics);
if (snap.sim?.status !== "complete")
  throw Error("Showcase machine did not complete");
const rec = await page.evaluate(() => window.captureEngine.stopRecording());
await writeFile(
  "showcase/building-the-heavens.json.gz",
  gzipSync(JSON.stringify(rec)),
);
console.log(
  "frames",
  rec.frames.length,
  "seconds",
  rec.frames.reduce((n, f) => n + f.deltaMs, 0) / 1000,
);
await browser.close();

await unlink(new URL("../capture.html", import.meta.url));
