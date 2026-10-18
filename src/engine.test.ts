/// <reference types="node" />
import { it, expect, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { readFile } from "node:fs/promises";
import { game, BACKGROUND } from "./game";
it("loads the shipped files and runs the game through the engine", async () => {
  vi.stubGlobal(
    "fetch",
    async (url: string) => new Response(await readFile(url)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(new Uint8Array(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      decodeAudioData() {
        return Promise.resolve({});
      }
    },
  );
  const canvas = createCanvas(1280, 720),
    events = new EventTarget();
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: 1280,
    height: 720,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 60),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => events,
    },
  });
  const loaded: string[] = [];
  engine.events.on("asset:loaded", (e) => loaded.push(e.path));
  try {
    await engine.initialize();
    expect(loaded.length).toBeGreaterThan(60);
    await engine.advance(2);
    expect(engine.state.screen).toBe("title");
    engine.apply((s) => engine.debug.setScreen(s, "howto"));
    for (let i = 0; i < 5; i++) {
      engine.apply((s) => engine.debug.setHowtoPage(s, i));
      await engine.advance(1);
    }
    engine.apply((s) => engine.debug.setScreen(s, "title"));
    const press = async (code: string) => {
      events.dispatchEvent(
        Object.assign(new Event("keydown"), { code, repeat: false }),
      );
      await engine.advance(1);
      events.dispatchEvent(Object.assign(new Event("keyup"), { code }));
      await engine.advance(1);
    };
    await press("Enter");
    expect(engine.state.screen).toBe("select");
    await press("Enter");
    expect(engine.state.screen).toBe("editor");
    engine.apply((s) =>
      engine.debug.loadSolution(
        s,
        engine.debug.referenceSolution(s, "campaign", 0),
      ),
    );
    await press("Space");
    await engine.advance(470);
    expect(engine.state.sim?.status).toBe("complete");
    expect(engine.debug.snapshot(engine.state).campaign.solved).toEqual([0]);
  } finally {
    engine.destroy();
    vi.unstubAllGlobals();
  }
});
