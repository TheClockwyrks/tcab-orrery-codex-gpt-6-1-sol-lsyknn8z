import * as C from "./constants";
import type {
  Challenge,
  Hex,
  PartState,
  PartKind,
  Molecule,
  OrreryState,
  SimState,
  MoteState,
  FaultKind,
  TapeCell,
  Pose,
} from "./game";
export const mod = (n: number) => ((n % 6) + 6) % 6;
export const same = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const rot = (h: Hex, n: number): Hex => {
  let { q, r } = h;
  for (let i = 0; i < mod(n); i++) [q, r] = [-r, q + r];
  return { q, r };
};
export const xy = (h: Hex) => ({
  x: C.FIELD_CX + C.HEX_PITCH * (h.q + h.r / 2),
  y: C.FIELD_CY + ((C.HEX_PITCH * Math.sqrt(3)) / 2) * h.r,
});
export const onField = (h: Hex) =>
  Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) <= C.FIELD_R;
export const hexes: Hex[] = [];
for (let r = -C.FIELD_R; r <= C.FIELD_R; r++)
  for (let q = -C.FIELD_R; q <= C.FIELD_R; q++)
    if (onField({ q, r })) hexes.push({ q, r });
export const target = (x: number, y: number) =>
  hexes
    .map((h) => ({ h, d: Math.hypot(x - xy(h).x, y - xy(h).y) }))
    .filter((v) => v.d <= C.HEX_HIT_R)
    .sort((a, b) => a.d - b.d || a.h.r - b.h.r || a.h.q - b.h.q)[0]?.h ?? null;
export const mechanism = (k: PartKind) => C.PARTS.indexOf(k) < 6;
export const arms = (ps: readonly PartState[]) =>
  ps.filter((p) => mechanism(p.kind));
export const spokes = (p: PartState) =>
  p.kind === "hexarm"
    ? [0, 1, 2, 3, 4, 5]
    : p.kind === "triarm"
      ? [0, 2, 4]
      : p.kind === "biarm"
        ? [0, 3]
        : [0];
export const point = (p: Hex, rotation: number, length = 1) =>
  add(p, {
    q: C.DIRS[mod(rotation)][0] * length,
    r: C.DIRS[mod(rotation)][1] * length,
  });
export const cost = (ps: readonly PartState[]) =>
  ps.reduce(
    (s, p) =>
      s + C.PART_COSTS[p.kind] * (p.kind === "track" ? p.cells!.length : 1),
    0,
  );
export const period = (ps: readonly PartState[]) =>
  Math.max(1, ...ps.map((p) => p.tape?.length ?? 0));
export const pattern = (p: PartState, ch: Challenge): Molecule | null =>
  p.kind === "rise"
    ? ch.reagents[p.index!]
    : p.kind === "set"
      ? ch.products[p.index!]
      : null;
const shapes: Partial<Record<PartKind, Hex[]>> = {
  bind: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ],
  triune: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ],
  sunder: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ],
  mirror: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ],
  ascend: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ],
  conjoin: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
  ],
  eclipse: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: -1 },
  ],
  manifold: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: -1 },
  ],
  confluence: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
  ],
  dispersion: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
  ],
  void: [{ q: 0, r: 0 }, ...C.DIRS.map(([q, r]) => ({ q, r }))],
};
export function footprint(p: PartState, ch: Challenge): Hex[] {
  if (p.kind === "track") return [...p.cells!];
  const pat = pattern(p, ch);
  let cells: readonly Hex[] = pat
    ? pat.motes
    : (shapes[p.kind] ?? [{ q: 0, r: 0 }]);
  if (p.kind === "set" && pat?.repeat)
    cells = [...cells, ...cells.map((h) => add(h, pat.repeat!.vector))];
  return cells.map((h) => add(p, rot(h, p.rotation)));
}
export function legal(ps: readonly PartState[], ch: Challenge): void {
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i],
      f = footprint(p, ch);
    if (f.some((h) => !onField(h))) throw Error("Rule 1: outside the field");
    if (p.kind === "track") {
      const cells = p.cells!;
      if (cells.some((h, j) => cells.slice(0, j).some((x) => same(x, h))))
        throw Error("Rule 3: repeated track cell");
      if (
        cells.some((h, j) => j > 0 && !adjacent(h, cells[j - 1])) ||
        (p.closed &&
          (cells.length < 3 || !adjacent(cells[0], cells[cells.length - 1])))
      )
        throw Error("Rule 6: track must be adjacent");
    }
    for (const b of ps.slice(0, i)) {
      const bf = footprint(b, ch);
      if (
        !mechanism(p.kind) &&
        !mechanism(b.kind) &&
        f.some((h) => bf.some((x) => same(h, x)))
      )
        throw Error("Rule 2: overlapping footprints");
      if (mechanism(p.kind) && mechanism(b.kind) && same(p, b))
        throw Error("Rule 4: occupied anchor");
      if (
        p.kind === "wheel" &&
        b.kind === "wheel" &&
        C.DIRS.some(([q, r]) =>
          C.DIRS.some(([Q, R]) =>
            same(add(p, { q, r }), add(b, { q: Q, r: R })),
          ),
        )
      )
        throw Error("Rule 4: wheel rings meet");
      if (
        ["rise", "set"].includes(p.kind) &&
        p.kind === b.kind &&
        p.index === b.index
      )
        throw Error("Rule 5: aperture already placed");
    }
  }
}
export const adjacent = (a: Hex, b: Hex) =>
  C.DIRS.some(([q, r]) => a.q - b.q === q && a.r - b.r === r);
export function makePart(
  id: number,
  kind: PartKind,
  q: number,
  r: number,
  rotation = 0,
  index: number | null = null,
): PartState {
  return {
    id,
    kind,
    q,
    r,
    rotation: mod(rotation),
    length: 1,
    cells: kind === "track" ? [{ q, r }] : null,
    closed: kind === "track" ? false : null,
    index,
    tape: mechanism(kind) ? [] : null,
  };
}
export const trim = (a: readonly TapeCell[]) => {
  const b = [...a];
  while (b.length && b[b.length - 1] === null) b.pop();
  return b;
};
export function validateChallenge(doc: unknown): Challenge {
  const c = doc as Challenge;
  if (
    !c ||
    typeof c.name !== "string" ||
    c.name.length < 1 ||
    c.name.length > C.NAME_MAX
  )
    throw Error("Invalid challenge name");
  if (
    !Array.isArray(c.reagents) ||
    !c.reagents.length ||
    !Array.isArray(c.products) ||
    !c.products.length
  )
    throw Error("Missing molecules");
  if (
    !Array.isArray(c.permitted) ||
    !c.permitted.length ||
    new Set(c.permitted).size !== c.permitted.length ||
    c.permitted.some((k) => !C.PARTS.slice(0, -2).includes(k)) ||
    c.permitted.length + c.reagents.length + c.products.length > C.TRAY_MAX
  )
    throw Error("Invalid permitted parts");
  if (!Number.isInteger(c.target) || c.target < 1)
    throw Error("Invalid target");
  const normalize = (m: Molecule): Molecule => {
    if (
      !m ||
      !Array.isArray(m.motes) ||
      !m.motes.length ||
      m.motes.some(
        (h) =>
          !Number.isInteger(h.q) ||
          !Number.isInteger(h.r) ||
          !C.MOTES.includes(h.type),
      )
    )
      throw Error("Invalid motes");
    if (m.motes.some((h, i) => m.motes.slice(0, i).some((x) => same(x, h))))
      throw Error("Duplicate mote hex");
    if (
      !Array.isArray(m.filaments) ||
      m.filaments.some(
        (f) =>
          ![1, 3].includes(f.weight) ||
          !adjacent(f.a, f.b) ||
          !m.motes.some((h) => same(h, f.a)) ||
          !m.motes.some((h) => same(h, f.b)),
      )
    )
      throw Error("Invalid filaments");
    const seen = new Set([0]);
    for (let i = 0; i < m.motes.length; i++)
      for (const f of m.filaments) {
        const a = m.motes.findIndex((h) => same(h, f.a)),
          b = m.motes.findIndex((h) => same(h, f.b));
        if (seen.has(a) || seen.has(b)) {
          seen.add(a);
          seen.add(b);
        }
      }
    if (seen.size !== m.motes.length) throw Error("Disconnected molecule");
    if (
      m.filaments.some((f, i) =>
        m.filaments
          .slice(0, i)
          .some(
            (b) =>
              (same(f.a, b.a) && same(f.b, b.b)) ||
              (same(f.a, b.b) && same(f.b, b.a)),
          ),
      )
    )
      throw Error("Duplicate filament");
    if (m.repeat) {
      const { vector, link } = m.repeat;
      if (
        !vector ||
        !Number.isInteger(vector.q) ||
        !Number.isInteger(vector.r) ||
        (!vector.q && !vector.r) ||
        !link ||
        ![1, 3].includes(link.weight) ||
        !adjacent(link.a, link.b) ||
        !m.motes.some((h) => same(h, link.a)) ||
        !m.motes.some((h) => same(add(h, vector), link.b)) ||
        m.motes.some((h) => m.motes.some((b) => same(add(h, vector), b)))
      )
        throw Error("Invalid repeat");
    }
    const cells = m.repeat
      ? [...m.motes, ...m.motes.map((h) => add(h, m.repeat!.vector))]
      : m.motes;
    if (
      !Array.from({ length: 6 }, (_, rotation) => rotation).some((rotation) => {
        const first = rot(cells[0], rotation);
        return hexes.some((h) => {
          const anchor = { q: h.q - first.q, r: h.r - first.r };
          return cells.every((h) => onField(add(anchor, rot(h, rotation))));
        });
      })
    )
      throw Error("Pattern does not fit the field");
    return { ...m, repeat: m.repeat ?? null };
  };
  return {
    ...c,
    reagents: c.reagents.map((m) => {
      if (m.repeat) throw Error("Reagents cannot repeat");
      return normalize(m);
    }),
    products: c.products.map(normalize),
  };
}
export const component = (sim: SimState, id: number): number[] => {
  const ids = new Set([id]);
  let change = true;
  while (change) {
    change = false;
    for (const f of sim.filaments)
      if (ids.has(f.a) !== ids.has(f.b)) {
        ids.add(f.a);
        ids.add(f.b);
        change = true;
      }
  }
  return [...ids];
};
type Work = { -readonly [K in keyof SimState]: SimState[K] };
const remove = (s: Work, ids: number[]) => {
  s.motes = s.motes.filter((m) => !ids.includes(m.id));
  s.filaments = s.filaments.filter(
    (f) => !ids.includes(f.a) && !ids.includes(f.b),
  );
  s.grips = s.grips.filter((g) => !ids.includes(g.mote));
};
const spawn = (
  s: Work,
  h: Hex,
  type: MoteState["type"],
  wheel: number | null = null,
) => {
  const m = { ...h, type, wheel, id: s.nextMoteId++ };
  s.motes = [...s.motes, m];
  return m;
};
export function settle(
  sim: SimState,
  ps: readonly PartState[],
  ch: Challenge,
  completion: boolean,
): SimState {
  const s: Work = { ...sim };
  const sorted = [...ps].sort((a, b) => a.r - b.r || a.q - b.q);
  const at = (h: Hex) => s.motes.find((m) => same(m, h));
  const free = (m: MoteState | undefined) =>
    m &&
    m.wheel === null &&
    !s.filaments.some((f) => f.a === m.id || f.b === m.id) &&
    !s.grips.some((g) => g.mote === m.id);
  const unheld = (id: number) =>
    !s.grips.some((g) => component(s, id).includes(g.mote));
  for (const wave of [
    [
      "wane",
      "mirror",
      "ascend",
      "conjoin",
      "eclipse",
      "confluence",
      "dispersion",
    ],
    ["bind", "manifold", "triune"],
    ["sunder"],
    ["void"],
  ])
    for (const p of sorted.filter((p) => wave.includes(p.kind))) {
      const hs = footprint(p, ch),
        ms = hs.map(at),
        a = ms[0],
        b = ms[1];
      const type = (id: number, t: MoteState["type"]) => {
        s.motes = s.motes.map((m) => (m.id === id ? { ...m, type: t } : m));
      };
      const essence = (m: MoteState | undefined) =>
        m && C.ESSENCES.some((t) => t === m.type);
      if (p.kind === "wane" && a && a.wheel === null && essence(a))
        type(a.id, "dust");
      if (
        p.kind === "mirror" &&
        essence(a) &&
        b?.type === "dust" &&
        b.wheel === null
      )
        type(b.id, a!.type);
      if (
        p.kind === "ascend" &&
        a?.type === "mercury" &&
        free(a) &&
        b &&
        b.wheel === null
      ) {
        const n = C.PLANETS.findIndex((t) => t === b.type);
        if (n >= 0 && n < C.PLANETS.length - 1) {
          remove(s, [a.id]);
          type(b.id, C.PLANETS[n + 1]);
        }
      }
      if (
        p.kind === "conjoin" &&
        a &&
        b &&
        a.type === b.type &&
        free(a) &&
        free(b) &&
        !ms[2]
      ) {
        const n = C.PLANETS.findIndex((t) => t === a.type);
        if (n >= 0 && n < C.PLANETS.length - 1) {
          remove(s, [a.id, b.id]);
          spawn(s, hs[2], C.PLANETS[n + 1]);
        }
      }
      if (
        p.kind === "eclipse" &&
        a?.type === "dust" &&
        b?.type === "dust" &&
        free(a) &&
        free(b) &&
        !ms[2] &&
        !ms[3]
      ) {
        remove(s, [a.id, b.id]);
        spawn(s, hs[2], "umbra");
        spawn(s, hs[3], "lumen");
      }
      if (
        p.kind === "confluence" &&
        !a &&
        ms.slice(1).every(free) &&
        C.ESSENCES.every((t) => ms.slice(1).some((m) => m?.type === t))
      ) {
        remove(
          s,
          ms.slice(1).map((m) => m!.id),
        );
        spawn(s, hs[0], "aether");
      }
      if (
        p.kind === "dispersion" &&
        a?.type === "aether" &&
        free(a) &&
        ms.slice(1).every((m) => !m)
      ) {
        remove(s, [a.id]);
        C.ESSENCES.forEach((t, i) => spawn(s, hs[i + 1], t));
      }
      if (["bind", "manifold", "triune"].includes(p.kind) && a?.wheel === null)
        for (const m of ms.slice(1))
          if (
            m?.wheel === null &&
            !(
              p.kind === "triune" &&
              (a.type !== "nova" || m.type !== "nova")
            ) &&
            !s.filaments.some(
              (f) =>
                (f.a === a.id && f.b === m.id) ||
                (f.b === a.id && f.a === m.id),
            )
          )
            s.filaments = [
              ...s.filaments,
              { a: a.id, b: m.id, weight: p.kind === "triune" ? 3 : 1 },
            ];
      if (p.kind === "sunder" && a && b)
        s.filaments = s.filaments.filter(
          (f) =>
            !((f.a === a.id && f.b === b.id) || (f.b === a.id && f.a === b.id)),
        );
      if (p.kind === "void" && a && free(a)) remove(s, [a.id]);
    }
  for (const p of sorted.filter((p) => p.kind === "set")) {
    const pat = pattern(p, ch)!;
    let k = 1;
    const repeat = pat.repeat;
    while (k <= s.motes.length / pat.motes.length + 1) {
      const hs = pat.motes.map((h) =>
        add(
          p,
          rot(
            add(
              h,
              repeat
                ? { q: repeat.vector.q * (k - 1), r: repeat.vector.r * (k - 1) }
                : { q: 0, r: 0 },
            ),
            p.rotation,
          ),
        ),
      );
      if (
        !hs.every(
          (h, i) => at(h)?.type === pat.motes[i].type && at(h)?.wheel === null,
        )
      )
        break;
      if (!repeat) break;
      k++;
    }
    const count = repeat ? k - 1 : 1;
    if (repeat && count < C.REPEAT_MIN) continue;
    const expected: { h: Hex; type: MoteState["type"] }[] = [];
    for (let j = 0; j < count; j++)
      for (const m of pat.motes)
        expected.push({
          h: add(
            p,
            rot(
              add(
                m,
                repeat
                  ? { q: repeat.vector.q * j, r: repeat.vector.r * j }
                  : { q: 0, r: 0 },
              ),
              p.rotation,
            ),
          ),
          type: m.type,
        });
    const matched = expected.map((e) => at(e.h));
    if (
      matched.some(
        (m, i) => !m || m.type !== expected[i].type || m.wheel !== null,
      )
    )
      continue;
    const ids = matched.map((m) => m!.id);
    if (
      !unheld(ids[0]) ||
      component(s, ids[0]).length !== ids.length ||
      !component(s, ids[0]).every((id) => ids.includes(id))
    )
      continue;
    const links = [];
    for (let j = 0; j < count; j++) {
      for (const f of pat.filaments)
        links.push({
          ...f,
          a: add(
            p,
            rot(
              add(
                f.a,
                repeat
                  ? { q: repeat.vector.q * j, r: repeat.vector.r * j }
                  : { q: 0, r: 0 },
              ),
              p.rotation,
            ),
          ),
          b: add(
            p,
            rot(
              add(
                f.b,
                repeat
                  ? { q: repeat.vector.q * j, r: repeat.vector.r * j }
                  : { q: 0, r: 0 },
              ),
              p.rotation,
            ),
          ),
        });
      if (repeat && j < count - 1) {
        const f = repeat.link;
        links.push({
          ...f,
          a: add(
            p,
            rot(
              add(f.a, { q: repeat.vector.q * j, r: repeat.vector.r * j }),
              p.rotation,
            ),
          ),
          b: add(
            p,
            rot(
              add(f.b, { q: repeat.vector.q * j, r: repeat.vector.r * j }),
              p.rotation,
            ),
          ),
        });
      }
    }
    if (
      links.length !== s.filaments.filter((f) => ids.includes(f.a)).length ||
      !links.every((l) =>
        s.filaments.some(
          (f) =>
            f.weight === l.weight &&
            ((f.a === at(l.a)?.id && f.b === at(l.b)?.id) ||
              (f.b === at(l.a)?.id && f.a === at(l.b)?.id)),
        ),
      )
    )
      continue;
    remove(s, ids);
    s.tallies = s.tallies.map((n, i) => (i === p.index ? n + count : n));
  }
  for (const p of sorted.filter((p) => p.kind === "rise")) {
    const pat = pattern(p, ch)!;
    const hs = pat.motes.map((m) => add(p, rot(m, p.rotation)));
    if (hs.every((h) => !at(h))) {
      const born = pat.motes.map((m, i) => spawn(s, hs[i], m.type));
      s.filaments = [
        ...s.filaments,
        ...pat.filaments.map((f) => ({
          a: born[pat.motes.findIndex((m) => same(m, f.a))].id,
          b: born[pat.motes.findIndex((m) => same(m, f.b))].id,
          weight: f.weight,
        })),
      ];
    }
  }
  const bank = [...s.areaHexes];
  const banked = (h: Hex) => {
    if (!bank.some((b) => same(b, h))) bank.push({ q: h.q, r: h.r });
  };
  s.motes.forEach(banked);
  for (const pose of s.poses) {
    const p = ps.find((p) => p.id === pose.part)!;
    for (const d of spokes(p))
      banked(point(pose.cell, pose.rotation + d, pose.length));
  }
  s.areaHexes = bank;
  if (
    completion &&
    ps.some((p) => p.kind === "set") &&
    s.tallies.every((n) => n >= ch.target)
  ) {
    s.status = "complete";
    s.fraction = 0;
    s.metrics = { cost: cost(ps), cycles: s.cycle + 1, area: bank.length };
  }
  return s;
}
export function start(state: OrreryState): OrreryState {
  if (!state.challenge) throw Error("No challenge open");
  let sim: SimState = {
    status: "running",
    cycle: 0,
    fraction: 0,
    speed: C.DEFAULT_SPEED_INDEX,
    motes: [],
    nextMoteId: 0,
    filaments: [],
    poses: arms(state.editor.parts).map((p) => ({
      part: p.id,
      rotation: p.rotation,
      length: p.length,
      cell: { q: p.q, r: p.r },
    })),
    grips: [],
    tallies: state.challenge.products.map(() => 0),
    areaHexes: [],
    fault: null,
    metrics: null,
  };
  const w: Work = { ...sim };
  for (const p of state.editor.parts.filter((p) => p.kind === "wheel"))
    for (let d = 0; d < 6; d++)
      spawn(w, point(p, d + p.rotation), C.WHEEL_MOTES[d], p.id);
  w.areaHexes = state.editor.parts
    .flatMap((p) => [
      ...footprint(p, state.challenge!),
      ...(mechanism(p.kind)
        ? spokes(p).map((d) => point(p, p.rotation + d, p.length))
        : []),
    ])
    .filter((h, i, a) => !a.slice(0, i).some((b) => same(h, b)));
  sim = settle(w, state.editor.parts, state.challenge, state.completion);
  return { ...state, sim };
}
export interface Motion {
  kind: "rest" | "translate" | "rotate";
  center: Hex;
  vector: Hex;
  turn: number;
}
const rest: Motion = {
  kind: "rest",
  center: { q: 0, r: 0 },
  vector: { q: 0, r: 0 },
  turn: 0,
};
export function plan(
  sim: SimState,
  ps: readonly PartState[],
): { sim: SimState; motions: Map<number, Motion>; poses: Pose[] } {
  let s: SimState = { ...sim };
  const poses = [...s.poses];
  const cmds = new Map<number, TapeCell>();
  const motions = new Map<number, Motion>();
  const fault = (kind: FaultKind, parts: number[], motes: number[] = []) => {
    s = { ...s, status: "faulted", fraction: 0, fault: { kind, parts, motes } };
  };
  for (const p of arms(ps)) {
    const pose = s.poses.find((x) => x.part === p.id)!;
    if (!pose) continue;
    const cmd = p.tape?.[s.cycle % period(ps)] ?? null;
    cmds.set(p.id, cmd);
    let f: FaultKind | null = null;
    if (p.kind === "wheel" && cmd && !cmd.startsWith("rotate"))
      f = "impossible";
    else if (cmd === "extend" || cmd === "retract") {
      if (p.kind !== "piston") f = "impossible";
      else if (cmd === "extend" && pose.length === C.ARM_MAX_LEN)
        f = "overextended";
      else if (cmd === "retract" && pose.length === C.ARM_MIN_LEN)
        f = "overretracted";
    } else if (cmd === "advance" || cmd === "recede") {
      const track = ps.find(
        (p) => p.kind === "track" && p.cells!.some((h) => same(h, pose.cell)),
      );
      if (!track) f = "unmounted";
      else {
        const idx =
          track.cells!.findIndex((h) => same(h, pose.cell)) +
          (cmd === "advance" ? 1 : -1);
        if (!track.closed && (idx < 0 || idx >= track.cells!.length))
          f = "track-end";
      }
    }
    if (f) {
      fault(f, [p.id]);
      return { sim: s, motions, poses };
    }
  }
  s = { ...s, grips: s.grips.filter((g) => cmds.get(g.part) !== "drop") };
  for (const p of arms(ps))
    if (cmds.get(p.id) === "grab") {
      const pose = s.poses.find((x) => x.part === p.id);
      if (!pose) continue;
      for (const spoke of spokes(p)) {
        const m = s.motes.find(
          (m) =>
            m.wheel === null &&
            same(m, point(pose.cell, pose.rotation + spoke, pose.length)),
        );
        if (
          m &&
          !s.grips.some(
            (g) => g.part === p.id && g.spoke === mod(pose.rotation + spoke),
          )
        )
          s = {
            ...s,
            grips: [
              ...s.grips,
              { part: p.id, spoke: mod(pose.rotation + spoke), mote: m.id },
            ],
          };
      }
    }
  const imposed = new Map<number, { motion: Motion; parts: number[] }>();
  for (const p of arms(ps)) {
    const pose = s.poses.find((x) => x.part === p.id);
    if (!pose) continue;
    const cmd = cmds.get(p.id);
    let motion = rest;
    let next = { ...pose };
    if (cmd?.startsWith("rotate")) {
      const turn = cmd === "rotate-cw" ? 1 : -1;
      motion = { ...rest, kind: "rotate", center: pose.cell, turn };
      next.rotation = mod(pose.rotation + turn);
    }
    if (cmd === "extend" || cmd === "retract") {
      const delta = cmd === "extend" ? 1 : -1;
      motion = {
        ...rest,
        kind: "translate",
        vector: point({ q: 0, r: 0 }, pose.rotation, delta),
      };
      next.length += delta;
    }
    if (cmd === "advance" || cmd === "recede") {
      const tr = ps.find(
        (p) => p.kind === "track" && p.cells!.some((h) => same(h, pose.cell)),
      )!;
      const n = tr.cells!.length;
      const cell =
        tr.cells![
          (tr.cells!.findIndex((h) => same(h, pose.cell)) +
            (cmd === "advance" ? 1 : -1) +
            n) %
            n
        ];
      motion = {
        ...rest,
        kind: "translate",
        vector: { q: cell.q - pose.cell.q, r: cell.r - pose.cell.r },
      };
      next = { ...next, cell };
    }
    poses[poses.findIndex((x) => x.part === p.id)] = next;
    const held =
      p.kind === "wheel"
        ? s.motes
            .filter((m) => m.wheel === p.id)
            .map((m) => ({ mote: m.id, spoke: 0 }))
        : s.grips.filter((g) => g.part === p.id);
    for (const g of held) {
      const group = component(s, g.mote);
      const m = s.motes.find((m) => m.id === g.mote)!;
      const im = cmd?.startsWith("pivot")
        ? {
            ...rest,
            kind: "rotate" as const,
            center: { q: m.q, r: m.r },
            turn: cmd === "pivot-cw" ? 1 : -1,
          }
        : motion;
      for (const id of group) {
        const prior = imposed.get(id);
        if (prior && JSON.stringify(prior.motion) !== JSON.stringify(im)) {
          fault(
            "torn",
            ps
              .filter((p) =>
                s.grips.some((g) => g.part === p.id && group.includes(g.mote)),
              )
              .map((p) => p.id),
            group.sort((a, b) => a - b),
          );
          return { sim: s, motions, poses };
        }
        imposed.set(id, { motion: im, parts: [...(prior?.parts ?? []), p.id] });
        motions.set(id, im);
      }
    }
  }
  return { sim: s, motions, poses };
}
export function moved(
  h: Hex,
  m: Motion | undefined,
  t: number,
): { x: number; y: number } {
  const a = xy(h);
  if (!m || m.kind === "rest") return a;
  if (m.kind === "translate") {
    const v = xy(m.vector),
      z = xy({ q: 0, r: 0 });
    return { x: a.x + (v.x - z.x) * t, y: a.y + (v.y - z.y) * t };
  }
  const c = xy(m.center),
    angle = ((m.turn * Math.PI) / 3) * t;
  return {
    x: c.x + (a.x - c.x) * Math.cos(angle) - (a.y - c.y) * Math.sin(angle),
    y: c.y + (a.x - c.x) * Math.sin(angle) + (a.y - c.y) * Math.cos(angle),
  };
}
export function advance(state: OrreryState, cycles: number): OrreryState {
  let sim = state.sim;
  if (!sim || !state.challenge) return state;
  const ps = state.editor.parts;
  let remaining = cycles;
  while (remaining > 1e-10 && sim.status === "running") {
    const p = plan(sim, ps);
    sim = p.sim;
    if (sim.status === "faulted") break;
    const end = Math.min(1, sim.fraction + remaining);
    for (let k = 1; k <= C.COLLISION_SAMPLES; k++) {
      const t = k / C.COLLISION_SAMPLES;
      if (t <= sim.fraction + 1e-10 || t > end + 1e-10) continue;
      const ids = new Set<number>();
      for (let i = 0; i < sim.motes.length; i++)
        for (let j = 0; j < i; j++) {
          const a = moved(sim.motes[i], p.motions.get(sim.motes[i].id), t),
            b = moved(sim.motes[j], p.motions.get(sim.motes[j].id), t);
          if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * C.MOTE_COLLIDE_R - 1e-8) {
            ids.add(sim.motes[i].id);
            ids.add(sim.motes[j].id);
          }
        }
      if (ids.size) {
        sim = {
          ...sim,
          status: "faulted",
          fraction: t,
          fault: {
            kind: "collision",
            parts: [],
            motes: [...ids].sort((a, b) => a - b),
          },
        };
        break;
      }
    }
    if (sim.status === "faulted") break;
    remaining -= end - sim.fraction;
    sim = { ...sim, fraction: end };
    if (end >= 1 - 1e-10) {
      sim = {
        ...sim,
        fraction: 0,
        poses: p.poses,
        grips: sim.grips.map((g) => {
          const old = sim!.poses.find((p) => p.part === g.part),
            next = p.poses.find((p) => p.part === g.part);
          return {
            ...g,
            spoke: mod(g.spoke + (next?.rotation ?? 0) - (old?.rotation ?? 0)),
          };
        }),
        motes: sim.motes.map((m) => {
          const motion = p.motions.get(m.id);
          let h: Hex = m;
          if (motion?.kind === "translate") h = add(m, motion.vector);
          else if (motion?.kind === "rotate")
            h = add(
              motion.center,
              rot(
                { q: m.q - motion.center.q, r: m.r - motion.center.r },
                motion.turn,
              ),
            );
          return { ...m, ...h };
        }),
      };
      sim = settle(sim, ps, state.challenge, state.completion);
      if (sim.status === "running") sim = { ...sim, cycle: sim.cycle + 1 };
    }
  }
  let next = { ...state, sim };
  if (
    sim.status === "complete" &&
    state.sim?.status !== "complete" &&
    state.challengeRef
  ) {
    const { mode, index } = state.challengeRef;
    const records = [
        ...state[mode === "campaign" ? "campaignRecords" : "extrasRecords"],
      ],
      old = records[index],
      m = sim.metrics!;
    records[index] = old
      ? {
          cost: Math.min(old.cost, m.cost),
          cycles: Math.min(old.cycles, m.cycles),
          area: Math.min(old.area, m.area),
        }
      : m;
    const solved = [
      ...new Set([
        ...state[mode === "campaign" ? "campaignSolved" : "extrasSolved"],
        index,
      ]),
    ].sort((a, b) => a - b);
    next = {
      ...next,
      menuIndex: 0,
      ...(mode === "campaign"
        ? {
            campaignRecords: records,
            campaignSolved: solved,
            unlockedCount: Math.min(
              state.campaignRecords.length,
              Math.max(state.unlockedCount, index + 2),
            ),
          }
        : { extrasRecords: records, extrasSolved: solved }),
    };
  }
  return next;
}
