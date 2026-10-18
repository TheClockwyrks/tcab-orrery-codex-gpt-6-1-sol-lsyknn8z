import type {
  Challenge,
  MoteType,
  PartKind,
  PartState,
  TapeCell,
} from "./game";
import { extraReference } from "./references";
import { extras } from "./challenges";
import { validateChallenge } from "./rules";
const single = (type: MoteType) => ({
  motes: [{ q: 0, r: 0, type }],
  filaments: [],
  repeat: null,
});
const p = (
  kind: PartKind,
  q: number,
  r: number,
  rotation = 0,
  index?: number,
): Partial<PartState> => ({
  kind,
  q,
  r,
  rotation,
  ...(index === undefined ? {} : { index }),
});
const a = (
  q: number,
  r: number,
  rotation: number,
  length: number,
  ev: Record<number, TapeCell>,
  kind: PartKind = "arm",
): Partial<PartState> => {
  const tape: TapeCell[] = Array.from(
    { length: Math.max(-1, ...Object.keys(ev).map(Number)) + 1 },
    () => null,
  );
  for (const [i, v] of Object.entries(ev)) tape[+i] = v;
  return { ...p(kind, q, r, rotation), length, tape };
};
const copy = (i: number, name: string): Challenge => ({ ...extras[i], name });
const custom = (
  name: string,
  reagents: Challenge["reagents"],
  products: Challenge["products"],
  permitted: PartKind[],
): Challenge =>
  validateChallenge({ name, reagents, products, permitted, target: 6 });
const pair = (second: MoteType = "luna") => ({
  motes: [
    { q: 0, r: 0, type: "luna" as const },
    { q: 1, r: 0, type: second },
  ],
  filaments: [{ a: { q: 0, r: 0 }, b: { q: 1, r: 0 }, weight: 1 }],
  repeat: null,
});
export const course: Challenge[] = [
  copy(0, "First Orbit"),
  custom(
    "The Travelling Telescope",
    [single("sol")],
    [single("sol")],
    ["arm", "piston", "track"],
  ),
  copy(1, "A Bond Between Moons"),
  copy(2, "The Fading Comet"),
  copy(3, "A Mirror of Fire"),
  copy(4, "The Planetary Ladder"),
  copy(5, "Two Become One"),
  copy(6, "Light & Shadow"),
  { ...copy(7, "The Fourfold Sky"), permitted: ["arm", "biarm", "confluence"] },
  { ...copy(8, "A Stronger Union"), permitted: ["arm", "triarm", "triune"] },
  custom(
    "The Branching Instrument",
    [single("luna")],
    [pair()],
    ["arm", "hexarm", "manifold"],
  ),
  custom(
    "Unfasten the Stars",
    [pair()],
    [single("luna"), single("luna")],
    ["arm", "sunder"],
  ),
  custom(
    "The Unravelled Aether",
    [single("aether")],
    ["nebula", "comet", "nova", "meteor"].map((t) => single(t as MoteType)),
    ["arm", "dispersion"],
  ),
  custom(
    "A Place for the Dust",
    [pair("dust")],
    [single("luna")],
    ["arm", "sunder", "void"],
  ),
  copy(9, "The Lunar Procession"),
  custom(
    "The Grand Orrery",
    [single("aether"), single("sol")],
    [
      ...["nebula", "comet", "nova", "meteor"].map((t) =>
        single(t as MoteType),
      ),
      single("sol"),
    ],
    ["arm", "piston", "track", "biarm", "triarm", "hexarm", "dispersion"],
  ),
];
function rawReference(i: number): { parts: Partial<PartState>[] } {
  const map = [0, -1, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, 9, -1];
  if (map[i] >= 0) {
    const ref = extraReference(map[i]);
    if (i === 8) {
      const n = ref.parts.findIndex((p) => p.kind === "arm");
      ref.parts[n] = { ...ref.parts[n], kind: "biarm" };
    }
    if (i === 9) {
      const n = ref.parts.findIndex((p) => p.kind === "arm");
      ref.parts[n] = { ...ref.parts[n], kind: "triarm" };
    }
    return ref;
  }
  if (i === 1)
    return {
      parts: [
        p("rise", -2, 0, 0, 0),
        p("set", -1, 1, 0, 0),
        {
          kind: "track",
          cells: [
            { q: -3, r: 0 },
            { q: -3, r: 1 },
          ],
          closed: false,
        },
        a(
          -3,
          0,
          0,
          1,
          {
            0: "grab",
            1: "extend",
            2: "advance",
            3: "drop",
            4: "recede",
            5: "retract",
          },
          "piston",
        ),
      ],
    };
  if (i === 10) {
    const ref = extraReference(1);
    ref.parts[1] = p("manifold", 0, 0);
    ref.parts[2] = p("set", 1, 1, 2, 0);
    ref.parts[5] = a(
      0,
      1,
      4,
      1,
      {
        8: "grab",
        9: "rotate-cw",
        10: "rotate-cw",
        11: "drop",
        12: "rotate-ccw",
        13: "rotate-ccw",
      },
      "hexarm",
    );
    return ref;
  }
  if (i === 11 || i === 13)
    return {
      parts: [
        p("rise", -2, 0, 0, 0),
        p("sunder", 0, 0, 5),
        p("set", 0, 2, 0, 0),
        ...(i === 11 ? [p("set", 2, -2, 0, 1)] : [p("void", 3, -3)]),
        a(0, -2, 2, 2, {
          0: "grab",
          1: "rotate-ccw",
          2: "drop",
          3: "rotate-cw",
        }),
        a(0, 1, 4, 1, {
          3: "grab",
          4: "rotate-cw",
          5: "rotate-cw",
          6: "rotate-cw",
          7: "drop",
          8: "rotate-ccw",
          9: "rotate-ccw",
          10: "rotate-ccw",
        }),
        i === 11
          ? a(1, -2, 1, 1, {
              3: "grab",
              4: "rotate-ccw",
              5: "drop",
              6: "rotate-cw",
            })
          : a(2, -2, 2, 1, {
              3: "grab",
              4: "rotate-cw",
              5: "rotate-cw",
              6: "rotate-cw",
              7: "drop",
              8: "rotate-ccw",
              9: "rotate-ccw",
              10: "rotate-ccw",
            }),
      ],
    };
  const ds = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const parts: Partial<PartState>[] = [
    p("rise", -2, 0, 0, 0),
    p("dispersion", 0, 0),
    a(-1, 0, 3, 1, {
      0: "grab",
      1: "rotate-cw",
      2: "rotate-cw",
      3: "rotate-cw",
      4: "drop",
      5: "rotate-ccw",
      6: "rotate-ccw",
      7: "rotate-ccw",
    }),
  ];
  ds.forEach(([q, r], j) => {
    parts.push(p("set", q * 3, r * 3, 0, j));
    const k = 8 + j * 8;
    parts.push(
      a(q * 2, r * 2, ([0, 1, 3, 4][j] + 3) % 6, 1, {
        [k]: "grab",
        [k + 1]: "rotate-cw",
        [k + 2]: "rotate-cw",
        [k + 3]: "rotate-cw",
        [k + 4]: "drop",
        [k + 5]: "rotate-ccw",
        [k + 6]: "rotate-ccw",
        [k + 7]: "rotate-ccw",
      }),
    );
  });
  if (i === 15) {
    parts.push(
      p("rise", -5, 3, 0, 1),
      p("set", -3, 3, 0, 4),
      a(-4, 3, 3, 1, {
        43: "grab",
        44: "rotate-cw",
        45: "rotate-cw",
        46: "rotate-cw",
        47: "drop",
        48: "rotate-ccw",
        49: "rotate-ccw",
        50: "rotate-ccw",
      }),
    );
  }
  return { parts };
}
export const courseReferences = course.map((_, i) => rawReference(i));
// Later benches retain room for alternate mechanisms and larger machines.
for (let i = 2; i < course.length; i++) {
  const min = courseReferences[i - 2].parts.length;
  const ref = courseReferences[i];
  let j = 0;
  while (ref.parts.length < min) {
    const h = [
      { q: 5, r: 0 },
      { q: 4, r: -1 },
      { q: 3, r: -2 },
      { q: 2, r: -3 },
      { q: 1, r: -4 },
      { q: 0, r: -5 },
      { q: -1, r: -4 },
      { q: -2, r: -3 },
      { q: 4, r: 1 },
      { q: 3, r: 2 },
      { q: 2, r: 3 },
      { q: 1, r: 4 },
      { q: 0, r: 5 },
    ][j++];
    if (!h) break;
    if (ref.parts.some((p) => p.q === h.q && p.r === h.r)) continue;
    ref.parts.push(a(h.q, h.r, 0, 1, {}));
  }
}
