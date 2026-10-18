import type { DeepReadonly } from "ts-essentials";
import type {
  OrreryState,
  PartKind,
  PartState,
  Mode,
  Screen,
  Instruction,
  MoteType,
  SimState,
  Metrics,
} from "./game";
import * as E from "./editor";
import * as R from "./rules";
import * as C from "./constants";
import { deferCue, clearCues } from "./events";
export type ReadState = DeepReadonly<OrreryState>;
const live = (s: ReadState): SimState => {
  if (!s.sim) throw Error("No live run");
  return s.sim;
};
const editSim = (
  s: ReadState,
  fn: (sim: SimState) => SimState,
): OrreryState => ({ ...s, sim: fn(live(s)) });
const integer = (n: number, min = 0, max = Infinity) => {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`Value outside bounds ${min}..${max}`);
  return n;
};
const pose = (
  s: ReadState,
  id: number,
  fn: (p: SimState["poses"][number]) => SimState["poses"][number],
) =>
  editSim(s, (sim) => {
    if (!sim.poses.some((p) => p.part === id)) throw Error("Unknown live pose");
    return { ...sim, poses: sim.poses.map((p) => (p.part === id ? fn(p) : p)) };
  });
export function snapshot(s: ReadState) {
  const planned = s.sim ? R.plan(s.sim, s.editor.parts) : null;
  const challenge = s.challenge
    ? {
        ...s.challenge,
        source: s.challengeRef?.mode ?? "custom",
        index: s.challengeRef?.index ?? null,
      }
    : null;
  return {
    version: C.ORRERY_DEBUG_VERSION,
    screen: s.screen,
    mode: s.mode,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    selectIndex: s.selectIndex,
    howtoPage: s.howtoPage,
    pointer: s.pointer,
    completion: s.completion,
    muted: s.muted,
    simTime: s.simTime,
    challenge,
    campaign: {
      count: E.list("campaign").length,
      unlockedCount: s.unlockedCount,
      solved: s.campaignSolved,
      records: s.campaignRecords,
      stashed: s.campaignMachines.flatMap((m, i) => (m ? [i] : [])),
      last: s.campaignLast,
    },
    extras: {
      count: E.list("extras").length,
      solved: s.extrasSolved,
      records: s.extrasRecords,
      stashed: s.extrasMachines.flatMap((m, i) => (m ? [i] : [])),
      last: s.extrasLast,
    },
    editor: {
      parts: s.editor.parts,
      cost: R.cost(s.editor.parts),
      period: R.period(s.editor.parts),
      selected: s.editor.selected,
      focus: s.editor.focus,
      cursor: s.editor.cursor,
      drag: s.editor.drag,
      undoDepth: s.editor.undo.length,
      redoDepth: s.editor.redo.length,
    },
    sim: s.sim
      ? {
          status: s.sim.status,
          cycle: s.sim.cycle,
          fraction: s.sim.fraction,
          speed: s.sim.speed,
          filaments: s.sim.filaments,
          poses: s.sim.poses,
          grips: s.sim.grips,
          tallies: s.sim.tallies,
          fault: s.sim.fault,
          metrics: s.sim.metrics,
          area: s.sim.areaHexes.length,
          motes: s.sim.motes.map((m) => ({
            ...m,
            ...R.moved(m, planned?.motions.get(m.id), s.sim!.fraction),
          })),
        }
      : null,
  };
}
export const debug = {
  version: C.ORRERY_DEBUG_VERSION,
  snapshot,
  reset: (_s: ReadState) => {
    clearCues();
    return E.initial();
  },
  reconcile: (s: ReadState): OrreryState => ({ ...s }),
  setCompletion: (s: ReadState, enabled: boolean): OrreryState => ({
    ...s,
    completion: enabled,
  }),
  setScreen: (s: ReadState, name: Screen) => E.screen(s, name),
  setMode: (s: ReadState, mode: Mode): OrreryState => ({ ...s, mode }),
  setMenuIndex: (s: ReadState, n: number): OrreryState => ({
    ...s,
    menuIndex: integer(n, 0, E.menuCount(s) - 1),
  }),
  setSelectIndex: (s: ReadState, n: number): OrreryState => ({
    ...s,
    selectIndex: integer(n, 0, E.list(s.mode).length - 1),
  }),
  setHowtoPage: (s: ReadState, n: number): OrreryState => ({
    ...s,
    howtoPage: integer(n, 0, C.HOWTO_PAGES - 1),
  }),
  setUnlockedCount: (s: ReadState, n: number): OrreryState => ({
    ...s,
    unlockedCount: integer(n, 1, E.list("campaign").length),
  }),
  setSolved: (
    s: ReadState,
    mode: Mode,
    index: number,
    solved: boolean,
  ): OrreryState => {
    integer(index, 0, E.list(mode).length - 1);
    const key = mode === "campaign" ? "campaignSolved" : "extrasSolved";
    return {
      ...s,
      [key]: [
        ...new Set(
          solved ? [...s[key], index] : s[key].filter((i) => i !== index),
        ),
      ].sort((a, b) => a - b),
    };
  },
  setRecord: (
    s: ReadState,
    mode: Mode,
    index: number,
    metric: keyof Metrics,
    value: number,
  ): OrreryState => {
    integer(index, 0, E.list(mode).length - 1);
    integer(value);
    const key = mode === "campaign" ? "campaignRecords" : "extrasRecords",
      records = [...s[key]];
    records[index] = {
      ...(records[index] ?? { cost: 0, cycles: 0, area: 0 }),
      [metric]: value,
    };
    return { ...s, [key]: records };
  },
  setLast: (s: ReadState, mode: Mode, index: number): OrreryState => ({
    ...s,
    [mode === "campaign" ? "campaignLast" : "extrasLast"]: integer(
      index,
      0,
      E.list(mode).length - 1,
    ),
  }),
  menuItemRect: E.menuRect,
  openChallenge: (s: ReadState, mode: Mode, index: number) =>
    E.open(s, mode, index),
  loadChallenge: E.loadChallenge,
  referenceSolution: (_s: ReadState, mode: Mode, index: number) =>
    E.reference(mode, index),
  clearMachine: (s: ReadState): OrreryState => {
    if (!s.challenge) throw Error("No challenge open");
    return {
      ...s,
      editor: { ...E.emptyEditor(), nextId: s.editor.nextId },
      sim: s.sim
        ? {
            ...s.sim,
            poses: [],
            grips: [],
            motes: s.sim.motes.filter((m) => m.wheel === null),
          }
        : null,
    };
  },
  placePart: (
    s: ReadState,
    kind: PartKind,
    q: number,
    r: number,
    rotation: number,
  ) => {
    if (["rise", "set", "track"].includes(kind))
      throw Error("Use the dedicated placement operation");
    return E.place(s, kind, q, r, integer(rotation, 0, 5));
  },
  placeRise: (
    s: ReadState,
    index: number,
    q: number,
    r: number,
    rotation: number,
  ) => E.place(s, "rise", q, r, integer(rotation, 0, 5), index),
  placeSet: (
    s: ReadState,
    index: number,
    q: number,
    r: number,
    rotation: number,
  ) => E.place(s, "set", q, r, integer(rotation, 0, 5), index),
  placeTrack: (s: ReadState, q: number, r: number) => E.place(s, "track", q, r),
  extendTrack: (s: ReadState, id: number, q: number, r: number) =>
    E.change(s, id, (p) => {
      if (p.kind !== "track") throw Error("Not a track");
      return { ...p, cells: [...p.cells!, { q, r }] };
    }),
  closeTrack: (s: ReadState, id: number) =>
    E.change(s, id, (p) => {
      if (p.kind !== "track") throw Error("Not a track");
      return { ...p, closed: true };
    }),
  removePart: (s: ReadState, id: number) => {
    let n = E.parts(
      s,
      s.editor.parts.filter((p) => p.id !== id),
    );
    if (n.sim)
      n = {
        ...n,
        sim: {
          ...n.sim,
          poses: n.sim.poses.filter((p) => p.part !== id),
          grips: n.sim.grips.filter((g) => g.part !== id),
          motes: n.sim.motes.filter((m) => m.wheel !== id),
        },
      };
    return n;
  },
  setPartRotation: (s: ReadState, id: number, rotation: number) =>
    E.change(s, id, (p) => ({ ...p, rotation: integer(rotation, 0, 5) })),
  setPartLength: (s: ReadState, id: number, length: number) =>
    E.change(s, id, (p) => {
      if (!R.mechanism(p.kind) || p.kind === "wheel")
        throw Error(`${p.kind} has no length`);
      return { ...p, length: integer(length, C.ARM_MIN_LEN, C.ARM_MAX_LEN) };
    }),
  movePart: (s: ReadState, id: number, q: number, r: number) =>
    E.change(s, id, (p) => ({
      ...p,
      q,
      r,
      cells:
        p.cells?.map((h) => ({ q: h.q + q - p.q, r: h.r + r - p.r })) ?? null,
    })),
  setTapeCell: (
    s: ReadState,
    id: number,
    col: number,
    instruction: Instruction | null,
  ) => {
    if (instruction !== null && !C.INSTRUCTIONS.includes(instruction))
      throw Error("Unknown instruction");
    return E.write(s, id, col, instruction);
  },
  loadSolution: E.loadSolution,
  readSolution: E.readSolution,
  setSelected: (s: ReadState, id: number | null): OrreryState => {
    if (id !== null && !s.editor.parts.some((p) => p.id === id))
      throw Error("Unknown part");
    return { ...s, editor: { ...s.editor, selected: id } };
  },
  setFocus: (s: ReadState, focus: "field" | "tape"): OrreryState => ({
    ...s,
    editor: { ...s.editor, focus },
  }),
  setCursor: (s: ReadState, id: number | null, col: number): OrreryState => {
    if (id !== null && !s.editor.parts.some((p) => p.id === id && p.tape))
      throw Error("Part has no tape row");
    return {
      ...s,
      editor: {
        ...s.editor,
        cursor: id === null ? null : { part: id, col: integer(col) },
      },
    };
  },
  pointerDown: (s: ReadState, x: number, y: number) =>
    E.pointer(s, "down", x, y),
  pointerMove: (s: ReadState, x: number, y: number) =>
    E.pointer(s, "move", x, y),
  pointerUp: (s: ReadState) => {
    const n = E.pointer(s, "up", s.pointer.x, s.pointer.y);
    if (n.editor.parts.length < s.editor.parts.length) deferCue(C.CUES.erase);
    else if (JSON.stringify(n.editor.parts) !== JSON.stringify(s.editor.parts))
      deferCue(C.CUES.place);
    return n;
  },
  startRun: R.start,
  stopRun: (s: ReadState): OrreryState => {
    live(s);
    return { ...s, sim: null };
  },
  setPaused: (s: ReadState, paused: boolean) =>
    editSim(s, (sim) => {
      if (!["running", "paused"].includes(sim.status))
        throw Error("Run is finished");
      return { ...sim, status: paused ? "paused" : "running" };
    }),
  setSpeed: (s: ReadState, speed: number) =>
    editSim(s, (sim) => ({
      ...sim,
      speed: integer(speed, 0, C.SPEEDS.length - 1),
    })),
  setCycle: (s: ReadState, cycle: number) =>
    editSim(s, (sim) => ({ ...sim, cycle: integer(cycle) })),
  setTally: (s: ReadState, index: number, n: number) =>
    editSim(s, (sim) => {
      integer(index, 0, sim.tallies.length - 1);
      return {
        ...sim,
        tallies: sim.tallies.map((t, i) => (i === index ? integer(n) : t)),
      };
    }),
  clearMotes: (s: ReadState) =>
    editSim(s, (sim) => ({ ...sim, motes: [], filaments: [], grips: [] })),
  spawnMote: (s: ReadState, q: number, r: number, type: MoteType) =>
    editSim(s, (sim) => {
      if (!C.MOTES.includes(type) || sim.motes.some((m) => R.same(m, { q, r })))
        throw Error("Invalid mote or occupied hex");
      return {
        ...sim,
        motes: [...sim.motes, { id: sim.nextMoteId, q, r, type, wheel: null }],
        nextMoteId: sim.nextMoteId + 1,
      };
    }),
  removeMote: (s: ReadState, id: number) =>
    editSim(s, (sim) => ({
      ...sim,
      motes: sim.motes.filter((m) => m.id !== id),
      filaments: sim.filaments.filter((f) => f.a !== id && f.b !== id),
      grips: sim.grips.filter((g) => g.mote !== id),
    })),
  linkMotes: (s: ReadState, a: number, b: number, weight: number) =>
    editSim(s, (sim) => {
      const A = sim.motes.find((m) => m.id === a),
        B = sim.motes.find((m) => m.id === b);
      if (
        !A ||
        !B ||
        A.wheel !== null ||
        B.wheel !== null ||
        !R.adjacent(A, B) ||
        ![1, 3].includes(weight) ||
        sim.filaments.some(
          (f) => (f.a === a && f.b === b) || (f.a === b && f.b === a),
        )
      )
        throw Error("Invalid filament");
      return { ...sim, filaments: [...sim.filaments, { a, b, weight }] };
    }),
  unlinkMotes: (s: ReadState, a: number, b: number) =>
    editSim(s, (sim) => {
      const filaments = sim.filaments.filter(
        (f) => !((f.a === a && f.b === b) || (f.a === b && f.b === a)),
      );
      if (filaments.length === sim.filaments.length) throw Error("No filament");
      return { ...sim, filaments };
    }),
  setGrip: (s: ReadState, id: number, spoke: number, mote: number) =>
    editSim(s, (sim) => {
      const p = s.editor.parts.find((p) => p.id === id),
        pose = sim.poses.find((p) => p.part === id),
        m = sim.motes.find((m) => m.id === mote);
      if (
        !p ||
        p.kind === "wheel" ||
        !pose ||
        !R.spokes(p)
          .map((d) => R.mod(d + pose.rotation))
          .includes(spoke) ||
        !m ||
        m.wheel !== null ||
        !R.same(m, R.point(pose.cell, spoke, pose.length))
      )
        throw Error("Invalid grip");
      return {
        ...sim,
        grips: [
          ...sim.grips.filter((g) => g.part !== id || g.spoke !== spoke),
          { part: id, spoke, mote },
        ],
      };
    }),
  releaseGrip: (s: ReadState, id: number, spoke: number) =>
    editSim(s, (sim) => ({
      ...sim,
      grips: sim.grips.filter((g) => g.part !== id || g.spoke !== spoke),
    })),
  setPoseRotation: (s: ReadState, id: number, rotation: number) =>
    pose(s, id, (p) => ({ ...p, rotation: integer(rotation, 0, 5) })),
  setPoseLength: (s: ReadState, id: number, length: number) =>
    pose(s, id, (p) => ({
      ...p,
      length: integer(length, C.ARM_MIN_LEN, C.ARM_MAX_LEN),
    })),
  setPoseCell: (s: ReadState, id: number, q: number, r: number) =>
    pose(s, id, (p) => ({ ...p, cell: { q, r } })),
};
export type DebugApi = typeof debug;
export type DebugPart = PartState;
