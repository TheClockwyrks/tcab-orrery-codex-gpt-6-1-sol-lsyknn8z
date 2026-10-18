import { describe, it, expect } from "vitest";
import * as E from "./editor";
import * as R from "./rules";
import { debug } from "./debug";
import type { OrreryState, MoteType } from "./game";
function scenario(): OrreryState {
  let s = E.open(E.initial(), "extras", 0);
  s = { ...s, completion: false };
  s = R.start(s);
  return debug.clearMotes(s);
}
function mote(s: OrreryState, q: number, r: number, type: MoteType = "sol") {
  return debug.spawnMote(s, q, r, type);
}
describe("machine rules", () => {
  it("completes a repeating transfer with a shared tape", () => {
    let s = E.open(E.initial(), "campaign", 0);
    s = E.loadSolution(s, E.reference("campaign", 0));
    s = R.start(s);
    s = R.advance(s, 100);
    expect(s.sim?.status).toBe("complete");
    expect(s.sim?.tallies).toEqual([6]);
    expect(s.campaignSolved).toEqual([0]);
    expect(s.unlockedCount).toBe(2);
  });
  it("stops at the first swept collision sample", () => {
    let s = scenario();
    s = E.place(s, "arm", 0, 0);
    s = mote(mote(s, 1, 0), 1, 1);
    s = debug.setGrip(s, 0, 0, 0);
    s = E.write(s, 0, 0, "rotate-cw");
    s = R.advance(s, 1);
    expect(s.sim?.fault?.kind).toBe("collision");
    expect(s.sim?.fraction).toBe(3 / 8);
  });
  it("leaves the neighboring outer arc clear", () => {
    let s = scenario();
    s = E.place(s, "arm", 0, 0);
    s = mote(mote(s, 1, 0), 1, -1);
    s = debug.setGrip(s, 0, 0, 0);
    s = E.write(s, 0, 0, "rotate-cw");
    s = R.advance(s, 1);
    expect(s.sim?.fault).toBe(null);
    expect(s.sim?.motes.find((m) => m.id === 0)).toMatchObject({ q: 0, r: 1 });
  });
  it("faults a non-piston extension before moving", () => {
    let s = scenario();
    s = E.place(s, "arm", 0, 0);
    s = E.write(s, 0, 0, "extend");
    s = R.advance(s, 1);
    expect(s.sim?.fault).toEqual({ kind: "impossible", parts: [0], motes: [] });
  });
  it("integrates the same boundaries across frame partitions", () => {
    let a = E.open(E.initial(), "campaign", 0);
    a = E.loadSolution(a, E.reference("campaign", 0));
    a = R.start(a);
    let b = a;
    a = R.advance(a, 9);
    for (let i = 0; i < 180; i++) b = R.advance(b, 0.05);
    expect(b.sim?.cycle).toBe(a.sim?.cycle);
    expect(b.sim?.motes).toEqual(a.sim?.motes);
    expect(b.sim?.poses).toEqual(a.sim?.poses);
  });
  it("binds then sunders in separate waves", () => {
    let s = scenario();
    s = E.place(s, "bind", 0, 0);
    s = mote(mote(s, 0, 0, "nova"), 1, 0, "nova");
    s = { ...s, sim: R.settle(s.sim!, s.editor.parts, s.challenge!, false) };
    expect(s.sim?.filaments.length).toBe(1);
  });
  it("rejects overlapping sigil footprints without changing the old state", () => {
    const s = E.place(scenario(), "bind", 0, 0);
    expect(() => E.place(s, "wane", 1, 0)).toThrow(/Rule 2/);
    expect(s.editor.parts).toHaveLength(1);
  });
});
describe("editor transitions", () => {
  it("places by dragging, supports history, and preserves identity", () => {
    let s = E.open(E.initial(), "campaign", 0);
    s = E.pointer(s, "down", 70, 70);
    s = E.pointer(s, "move", 616, 304);
    s = E.pointer(s, "up", 616, 304);
    expect(s.editor.parts[0].kind).toBe("arm");
    expect(s.editor.undo).toHaveLength(1);
    s = E.key(s, "undo");
    expect(s.editor.parts).toHaveLength(0);
    s = E.key(s, "redo");
    expect(s.editor.parts[0].id).toBe(0);
  });
  it("writes sparse tapes and trims trailing blanks", () => {
    let s = E.place(scenario(), "arm", 0, 0);
    s = E.write(s, 0, 4, "grab");
    expect(s.editor.parts[0].tape).toEqual([null, null, null, null, "grab"]);
    s = E.write(s, 0, 4, null);
    expect(s.editor.parts[0].tape).toEqual([]);
  });
  it("wraps menus and remembers the title entry", () => {
    let s = E.key(E.initial(), "down");
    s = E.key(s, "confirm");
    expect(s.mode).toBe("extras");
    s = E.key(s, "back");
    expect(s.menuIndex).toBe(1);
  });
  it("keeps machines for the current session", () => {
    let s = E.open(E.initial(), "campaign", 0, true);
    s = E.place(s, "arm", 0, 0);
    s = E.screen(s, "select");
    s = E.open(s, "campaign", 0, true);
    expect(s.editor.parts).toHaveLength(1);
    expect(s.editor.undo).toHaveLength(0);
  });
  it("validates custom challenge documents atomically", () => {
    const s = E.initial();
    expect(() => E.loadChallenge(s, { name: "" })).toThrow(/name/);
    expect(s.challenge).toBe(null);
  });
});

describe("reference solutions", () => {
  for (let i = 0; i < 10; i++)
    it(`completes extra ${i + 1}`, () => {
      let s = E.open(E.initial(), "extras", i);
      s = E.loadSolution(s, E.reference("extras", i));
      s = R.start(s);
      s = R.advance(s, 600);
      if (s.sim?.fault)
        console.log(i, s.sim.cycle, s.sim.fraction, s.sim.motes);
      expect(s.sim?.fault).toBe(null);
      expect(s.sim?.status).toBe("complete");
    });
});

describe("campaign solutions", () => {
  for (let i = 0; i < E.list("campaign").length; i++)
    it(`completes campaign ${i + 1}`, () => {
      let s = E.open(E.initial(), "campaign", i);
      s = E.loadSolution(s, E.reference("campaign", i));
      s = R.start(s);
      s = R.advance(s, 600);
      if (s.sim?.fault)
        console.log(i, s.sim.cycle, s.sim.fraction, s.sim.fault);
      expect(s.sim?.fault).toBe(null);
      expect(s.sim?.status).toBe("complete");
    });
});

describe("motion contracts", () => {
  for (const [name, length, obstacle, collision] of [
    ["A", 1, [1, 1], true],
    ["B", 1, [1, -1], false],
    ["C", 2, [1, 0], false],
    ["D", 2, [1, 1], true],
  ] as const)
    it(`matches rotation example ${name}`, () => {
      let s = scenario();
      s = E.place(s, "arm", 0, 0);
      s = debug.setPoseLength(s, 0, length);
      s = mote(mote(s, length, 0), obstacle[0], obstacle[1]);
      s = debug.setGrip(s, 0, 0, 0);
      s = E.write(s, 0, 0, "rotate-cw");
      s = R.advance(s, 1);
      expect(s.sim?.fault?.kind === "collision").toBe(collision);
    });
  for (const [q, r] of [
    [2, -1],
    [1, 1],
    [3, -1],
  ])
    it(`keeps a piston clear of ${q},${r}`, () => {
      let s = scenario();
      s = E.place(s, "piston", 0, 0);
      s = mote(mote(s, 1, 0), q, r);
      s = debug.setGrip(s, 0, 0, 0);
      s = E.write(s, 0, 0, "extend");
      s = R.advance(s, 1);
      expect(s.sim?.fault).toBe(null);
    });
  it("updates a held spoke as its arm turns", () => {
    let s = scenario();
    s = E.place(s, "arm", 0, 0);
    s = mote(s, 1, 0);
    s = debug.setGrip(s, 0, 0, 0);
    s = E.write(s, 0, 0, "rotate-cw");
    s = R.advance(s, 1);
    expect(s.sim?.grips[0].spoke).toBe(1);
    s = debug.releaseGrip(s, 0, 1);
    expect(s.sim?.grips).toEqual([]);
  });
  it("tears a constellation whose grips impose different motions", () => {
    let s = scenario();
    s = E.place(s, "arm", 0, 0);
    s = E.place(s, "arm", 2, -1, 2);
    s = mote(mote(s, 1, 0), 2, 0);
    s = debug.linkMotes(s, 0, 1, 1);
    s = debug.setGrip(s, 0, 0, 0);
    s = debug.setGrip(s, 1, 2, 0);
    s = E.write(s, 0, 0, "rotate-cw");
    s = R.advance(s, 1);
    expect(s.sim?.fault?.kind).toBe("torn");
    expect(s.sim?.fault?.parts).toEqual([0, 1]);
  });
});
describe("menu gestures and macros", () => {
  it("takes a menu item only when both edges were inside it", () => {
    let s = E.initial();
    const a = E.menuRect(s, 0)!,
      b = E.menuRect(s, 1)!;
    s = E.pointer(s, "down", a.x + 50, a.y + 20);
    s = E.pointer(s, "move", b.x + 50, b.y + 20);
    s = E.pointer(s, "up", b.x + 50, b.y + 20);
    expect(s.screen).toBe("title");
    s = E.pointer(s, "down", b.x + 50, b.y + 20);
    s = E.pointer(s, "up", b.x + 50, b.y + 20);
    expect(s.mode).toBe("extras");
    expect(s.screen).toBe("select");
  });
  it("shows every campaign row inside the stage", () => {
    const s = E.screen(E.initial(), "select");
    for (let i = 0; i < E.list("campaign").length; i++) {
      const r = E.menuRect(s, i)!;
      expect(r.y + r.h).toBeLessThan(720);
    }
  });
  it("writes a track return after drop, reach and rotation", () => {
    let s = E.open(E.initial(), "campaign", 1);
    s = E.loadSolution(s, E.reference("campaign", 1));
    const p = s.editor.parts.find((p) => p.kind === "piston")!;
    s = debug.setFocus(s, "tape");
    s = debug.setCursor(s, p.id, 3);
    s = E.key(s, "ins-reset");
    expect(
      s.editor.parts.find((t) => t.id === p.id)?.tape?.slice(3, 6),
    ).toEqual(["drop", "retract", "recede"]);
  });
  it("refuses malformed repeat and disconnected patterns", () => {
    const c = E.list("extras")[0];
    expect(() =>
      E.loadChallenge(E.initial(), {
        ...c,
        products: [
          {
            ...c.products[0],
            repeat: {
              vector: { q: 0, r: 0 },
              link: { a: { q: 0, r: 0 }, b: { q: 1, r: 0 }, weight: 1 },
            },
          },
        ],
      }),
    ).toThrow(/repeat/);
  });
});
