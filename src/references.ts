import type { PartState, PartKind, TapeCell } from "./game";
export type Reference = { parts: Partial<PartState>[] };
const part = (
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
const tape = (length: number, events: Record<number, TapeCell>): TapeCell[] => {
  const t: TapeCell[] = Array.from({ length }, () => null);
  for (const [i, ins] of Object.entries(events)) t[Number(i)] = ins;
  while (t.length && t[t.length - 1] === null) t.pop();
  return t;
};
const arm = (
  q: number,
  r: number,
  rotation: number,
  length: number,
  P: number,
  events: Record<number, TapeCell>,
  kind: PartKind = "arm",
) => ({ ...part(kind, q, r, rotation), length, tape: tape(P, events) });
export function extraReference(index: number): Reference {
  if (index === 0)
    return {
      parts: [
        part("rise", -1, 0, 0, 0),
        part("set", 0, -1, 0, 0),
        arm(0, 0, 3, 1, 4, {
          0: "grab",
          1: "rotate-cw",
          2: "drop",
          3: "rotate-ccw",
        }),
      ],
    };
  if ([1, 8, 9].includes(index))
    return {
      parts: [
        part("rise", -2, 0, 0, 0),
        part(index === 8 ? "triune" : "bind", 0, 0),
        part("set", -1, 2, 4, 0),
        arm(-2, 3, 4, 3, 14, {
          0: "grab",
          1: "rotate-cw",
          2: "drop",
          3: "rotate-ccw",
        }),
        arm(0, -2, 2, 2, 14, {
          4: "grab",
          5: "rotate-ccw",
          6: "drop",
          7: "rotate-cw",
        }),
        arm(0, 1, 4, 1, 14, {
          8: "grab",
          9: "rotate-ccw",
          10: "rotate-ccw",
          11: "drop",
          12: "rotate-cw",
          13: "rotate-cw",
        }),
      ],
    };
  if (index === 2)
    return {
      parts: [
        part("rise", -3, 1, 0, 0),
        part("wane", -2, 0),
        part("bind", 0, 0),
        part("set", -1, 2, 4, 0),
        arm(-3, 0, 1, 1, 18, {
          0: "grab",
          1: "rotate-ccw",
          2: "drop",
          3: "rotate-cw",
          6: "grab",
          7: "rotate-ccw",
          8: "drop",
          9: "rotate-cw",
        }),
        arm(-2, 3, 4, 3, 18, {
          3: "grab",
          4: "rotate-cw",
          5: "drop",
          6: "rotate-ccw",
        }),
        arm(0, -2, 2, 2, 18, {
          9: "grab",
          10: "rotate-ccw",
          11: "drop",
          12: "rotate-cw",
        }),
        arm(0, 1, 4, 1, 18, {
          12: "grab",
          13: "rotate-ccw",
          14: "rotate-ccw",
          15: "drop",
          16: "rotate-cw",
          17: "rotate-cw",
        }),
      ],
    };
  if (index === 3)
    return {
      parts: [
        part("rise", -4, 2, 0, 0),
        part("mirror", -3, 0),
        part("bind", 0, 0),
        part("set", -1, 2, 4, 0),
        arm(-4, 0, 5, 1, 26, { 9: "rotate-ccw", 25: "rotate-cw" }, "wheel"),
        arm(-3, 1, 2, 1, 26, {
          0: "grab",
          1: "rotate-ccw",
          2: "rotate-ccw",
          3: "rotate-ccw",
          4: "drop",
          5: "rotate-cw",
          6: "rotate-cw",
          7: "rotate-cw",
          10: "grab",
          11: "rotate-ccw",
          12: "rotate-ccw",
          13: "rotate-ccw",
          14: "drop",
          15: "rotate-cw",
          16: "rotate-cw",
          17: "rotate-cw",
        }),
        arm(-2, 3, 4, 3, 26, {
          5: "grab",
          6: "rotate-cw",
          7: "drop",
          8: "rotate-ccw",
        }),
        arm(0, -2, 2, 2, 26, {
          15: "grab",
          16: "rotate-ccw",
          17: "drop",
          18: "rotate-cw",
        }),
        arm(0, 1, 4, 1, 26, {
          19: "grab",
          20: "rotate-ccw",
          21: "rotate-ccw",
          22: "drop",
          23: "rotate-cw",
          24: "rotate-cw",
        }),
      ],
    };
  if (index === 4)
    return {
      parts: [
        part("rise", 0, -4, 0, 0),
        part("rise", -5, 3, 0, 1),
        part("ascend", 0, 0),
        part("set", 0, 2, 0, 0),
        arm(-2, 3, 3, 3, 12, {
          0: "grab",
          1: "rotate-ccw",
          2: "rotate-ccw",
          3: "rotate-ccw",
          4: "rotate-ccw",
          5: "drop",
          6: "rotate-cw",
          7: "rotate-cw",
          8: "rotate-cw",
          9: "rotate-cw",
        }),
        arm(0, -2, 4, 2, 12, {
          0: "grab",
          1: "rotate-ccw",
          2: "rotate-ccw",
          3: "rotate-ccw",
          4: "drop",
          5: "rotate-cw",
          6: "rotate-cw",
          7: "rotate-cw",
        }),
        arm(0, 1, 5, 1, 12, {
          6: "grab",
          7: "rotate-cw",
          8: "rotate-cw",
          9: "drop",
          10: "rotate-ccw",
          11: "rotate-ccw",
        }),
      ],
    };
  if (index === 5)
    return {
      parts: [
        part("rise", -2, 0, 0, 0),
        part("conjoin", 0, 0),
        part("set", 1, 1, 0, 0),
        arm(-2, 3, 4, 3, 12, {
          0: "grab",
          1: "rotate-cw",
          2: "drop",
          3: "rotate-ccw",
        }),
        arm(0, -2, 2, 2, 12, {
          4: "grab",
          5: "rotate-ccw",
          6: "drop",
          7: "rotate-cw",
        }),
        arm(0, 2, 4, 1, 12, {
          8: "grab",
          9: "rotate-cw",
          10: "drop",
          11: "rotate-ccw",
        }),
      ],
    };
  if (index === 6)
    return {
      parts: [
        part("rise", -2, 0, 0, 0),
        part("eclipse", 0, 0),
        part("bind", 1, 2, 1),
        part("set", -1, 3, 5, 0),
        arm(-2, 3, 4, 3, 22, {
          0: "grab",
          1: "rotate-cw",
          2: "drop",
          3: "rotate-ccw",
        }),
        arm(0, -2, 2, 2, 22, {
          4: "grab",
          5: "rotate-ccw",
          6: "drop",
          7: "rotate-cw",
        }),
        arm(0, 2, 4, 1, 22, {
          8: "grab",
          9: "rotate-cw",
          10: "rotate-cw",
          11: "drop",
          12: "rotate-ccw",
          13: "rotate-ccw",
        }),
        arm(1, 1, 4, 2, 22, {
          8: "grab",
          9: "rotate-cw",
          10: "rotate-cw",
          11: "rotate-cw",
          12: "drop",
          13: "rotate-ccw",
          14: "rotate-ccw",
          15: "rotate-ccw",
        }),
        arm(0, 3, 5, 1, 22, {
          16: "grab",
          17: "rotate-ccw",
          18: "rotate-ccw",
          19: "drop",
          20: "rotate-cw",
          21: "rotate-cw",
        }),
      ],
    };
  const directions = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  return {
    parts: [
      part("confluence", 0, 0),
      part("set", 2, -1, 0, 0),
      ...directions.flatMap(([q, r], i) => [
        part("rise", q * 3, r * 3, 0, i),
        arm(q * 2, r * 2, [0, 1, 3, 4][i], 1, 38, {
          [i * 8]: "grab",
          [i * 8 + 1]: "rotate-cw",
          [i * 8 + 2]: "rotate-cw",
          [i * 8 + 3]: "rotate-cw",
          [i * 8 + 4]: "drop",
          [i * 8 + 5]: "rotate-ccw",
          [i * 8 + 6]: "rotate-ccw",
          [i * 8 + 7]: "rotate-ccw",
        }),
      ]),
      arm(1, -1, 2, 1, 38, {
        32: "grab",
        33: "rotate-ccw",
        34: "rotate-ccw",
        35: "drop",
        36: "rotate-cw",
        37: "rotate-cw",
      }),
    ],
  };
}
