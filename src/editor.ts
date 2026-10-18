import * as C from "./constants";
import * as R from "./rules";
import { extras } from "./challenges";
import { course as campaign, courseReferences } from "./campaign";
import { extraReference } from "./references";
import type {
  OrreryState,
  EditorState,
  PartState,
  PartKind,
  Screen,
  Mode,
  Challenge,
  TapeCell,
} from "./game";
export const emptyEditor = (): EditorState => ({
  parts: [],
  nextId: 0,
  selected: null,
  focus: "field",
  cursor: null,
  drag: null,
  undo: [],
  redo: [],
});
export const initial = (): OrreryState => ({
  screen: "title",
  mode: "campaign",
  menuIndex: 0,
  titleIndex: 0,
  selectIndex: 0,
  howtoPage: 0,
  unlockedCount: 1,
  campaignSolved: [],
  extrasSolved: [],
  campaignRecords: campaign.map(() => null),
  extrasRecords: extras.map(() => null),
  campaignMachines: campaign.map(() => null),
  extrasMachines: extras.map(() => null),
  campaignLast: 0,
  extrasLast: 0,
  challenge: null,
  challengeRef: null,
  editor: emptyEditor(),
  sim: null,
  pointer: { x: 0, y: 0, down: false },
  completion: true,
  simTime: 0,
  muted: false,
});
export const list = (mode: Mode) => (mode === "campaign" ? campaign : extras);
export const tray = (
  s: OrreryState,
): { kind: PartKind; index: number | null }[] =>
  s.challenge
    ? [
        ...C.PARTS.filter((k) => s.challenge!.permitted.includes(k)).map(
          (kind) => ({ kind, index: null }),
        ),
        ...s.challenge.reagents.map((_, index) => ({
          kind: "rise" as const,
          index,
        })),
        ...s.challenge.products.map((_, index) => ({
          kind: "set" as const,
          index,
        })),
      ]
    : [];
export function open(
  s: OrreryState,
  mode: Mode,
  index: number,
  restore = false,
): OrreryState {
  if (!Number.isInteger(index) || index < 0 || index >= list(mode).length)
    throw Error("Challenge index outside bounds");
  const parts = restore
    ? (s[mode === "campaign" ? "campaignMachines" : "extrasMachines"][index] ??
      [])
    : [];
  return {
    ...s,
    screen: "editor",
    mode,
    challenge: list(mode)[index],
    challengeRef: { mode, index },
    sim: null,
    menuIndex: 0,
    editor: {
      ...emptyEditor(),
      parts,
      nextId: Math.max(-1, ...parts.map((p) => p.id)) + 1,
    },
    ...(restore
      ? mode === "campaign"
        ? { campaignLast: index }
        : { extrasLast: index }
      : {}),
  };
}
export function screen(s: OrreryState, name: Screen): OrreryState {
  if (name === "editor") {
    if (!s.challenge) throw Error("No challenge open");
    return { ...s, screen: name };
  }
  let n = s;
  if (s.challengeRef) {
    const { mode, index } = s.challengeRef;
    const key = mode === "campaign" ? "campaignMachines" : "extrasMachines";
    const machines = [...s[key]];
    machines[index] = s.editor.parts;
    n = { ...n, [key]: machines };
  }
  return {
    ...n,
    screen: name,
    challenge: null,
    challengeRef: null,
    sim: null,
    editor: emptyEditor(),
    howtoPage: 0,
    menuIndex: name === "title" ? s.titleIndex : 0,
    selectIndex:
      name === "select"
        ? s[s.mode === "campaign" ? "campaignLast" : "extrasLast"]
        : s.selectIndex,
  };
}
export function parts(
  s: OrreryState,
  ps: readonly PartState[],
  history = false,
): OrreryState {
  if (!s.challenge) throw Error("No challenge open");
  R.legal(ps, s.challenge);
  const changed = JSON.stringify(s.editor.parts) !== JSON.stringify(ps);
  return {
    ...s,
    editor: {
      ...s.editor,
      parts: ps,
      selected: ps.some((p) => p.id === s.editor.selected)
        ? s.editor.selected
        : null,
      cursor: ps.some((p) => p.id === s.editor.cursor?.part)
        ? s.editor.cursor
        : null,
      undo:
        history && changed ? [...s.editor.undo, s.editor.parts] : s.editor.undo,
      redo: history && changed ? [] : s.editor.redo,
    },
  };
}
export function place(
  s: OrreryState,
  kind: PartKind,
  q: number,
  r: number,
  rotation = 0,
  index: number | null = null,
): OrreryState {
  if (
    !C.PARTS.includes(kind) ||
    !Number.isInteger(q) ||
    !Number.isInteger(r) ||
    !Number.isInteger(rotation) ||
    rotation < 0 ||
    rotation >= C.DIRS.length
  )
    throw Error("Invalid part kind, coordinates or rotation");
  const p = R.makePart(s.editor.nextId, kind, q, r, rotation, index);
  if (
    (kind === "rise" || kind === "set") &&
    (!s.challenge ||
      index === null ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >=
        (kind === "rise" ? s.challenge.reagents : s.challenge.products).length)
  )
    throw Error("Invalid aperture index");
  let n = parts(s, [...s.editor.parts, p]);
  n = { ...n, editor: { ...n.editor, nextId: p.id + 1 } };
  if (n.sim && R.mechanism(kind))
    n = {
      ...n,
      sim: {
        ...n.sim,
        poses: [
          ...n.sim.poses,
          { part: p.id, rotation, length: p.length, cell: { q, r } },
        ],
      },
    };
  if (n.sim && kind === "wheel") {
    const first = n.sim.nextMoteId;
    const fixtures = C.WHEEL_MOTES.map((type, d) => ({
      ...R.point({ q, r }, d + rotation),
      type,
      id: first + d,
      wheel: p.id,
    }));
    n = {
      ...n,
      sim: {
        ...n.sim,
        motes: [...n.sim.motes, ...fixtures],
        nextMoteId: first + C.WHEEL_MOTES.length,
      },
    };
  }
  return n;
}
export function change(
  s: OrreryState,
  id: number,
  fn: (p: PartState) => PartState,
  history = false,
): OrreryState {
  if (!s.editor.parts.some((p) => p.id === id)) throw Error("Unknown part");
  return parts(
    s,
    s.editor.parts.map((p) => (p.id === id ? fn(p) : p)),
    history,
  );
}
export function write(
  s: OrreryState,
  id: number,
  col: number,
  ins: TapeCell,
  history = false,
): OrreryState {
  if (!Number.isInteger(col) || col < 0) throw Error("Invalid tape column");
  return change(
    s,
    id,
    (p) => {
      if (!p.tape) throw Error("Part has no tape");
      const tape = [...p.tape];
      while (tape.length <= col) tape.push(null);
      tape[col] = ins;
      return { ...p, tape: R.trim(tape) };
    },
    history,
  );
}
export function loadChallenge(s: OrreryState, c: unknown): OrreryState {
  return {
    ...s,
    screen: "editor",
    challenge: R.validateChallenge(c),
    challengeRef: null,
    editor: emptyEditor(),
    sim: null,
  };
}
export type Solution = { parts: readonly Partial<PartState>[] };
export function readSolution(s: OrreryState): Solution {
  if (!s.challenge) throw Error("No challenge open");
  return {
    parts: s.editor.parts.map((p) =>
      p.kind === "track"
        ? { kind: p.kind, cells: p.cells, closed: p.closed }
        : R.mechanism(p.kind)
          ? {
              kind: p.kind,
              q: p.q,
              r: p.r,
              rotation: p.rotation,
              length: p.length,
              tape: p.tape,
            }
          : p.kind === "rise" || p.kind === "set"
            ? {
                kind: p.kind,
                index: p.index,
                q: p.q,
                r: p.r,
                rotation: p.rotation,
              }
            : { kind: p.kind, q: p.q, r: p.r, rotation: p.rotation },
    ),
  };
}
export function loadSolution(s: OrreryState, solution: Solution): OrreryState {
  if (!s.challenge) throw Error("No challenge open");
  let n = { ...s, editor: emptyEditor() };
  if (!solution || !Array.isArray(solution.parts))
    throw Error("Invalid solution parts");
  for (const p of solution.parts) {
    if (
      p.length !== undefined &&
      (!Number.isInteger(p.length) ||
        p.length < C.ARM_MIN_LEN ||
        p.length > C.ARM_MAX_LEN ||
        (p.kind === "wheel" && p.length !== 1))
    )
      throw Error("Invalid part length");
    if (
      p.tape &&
      p.tape.some((c: TapeCell) => c !== null && !C.INSTRUCTIONS.includes(c))
    )
      throw Error("Invalid tape instruction");
    if (
      p.kind === "track" &&
      (!p.cells?.length ||
        typeof p.closed !== "boolean" ||
        p.cells.some(
          (h: import("./game").Hex) =>
            !Number.isInteger(h.q) || !Number.isInteger(h.r),
        ))
    )
      throw Error("Invalid track cells");

    if (!p.kind) throw Error("Missing part kind");
    if (
      !s.challenge.permitted.includes(p.kind) &&
      !["rise", "set"].includes(p.kind)
    )
      throw Error("Part not permitted");
    const h = p.kind === "track" ? p.cells?.[0] : p;
    if (!h || h.q === undefined || h.r === undefined)
      throw Error("Invalid coordinates");
    n = place(n, p.kind, h.q, h.r, p.rotation ?? 0, p.index ?? null);
    n = change(n, n.editor.nextId - 1, (b) => ({
      ...b,
      length: p.length ?? 1,
      tape: b.tape ? R.trim(p.tape ?? []) : null,
      cells: p.cells ?? b.cells,
      closed: p.closed ?? b.closed,
    }));
  }
  return n;
}
export function reference(mode: Mode, index: number): Solution {
  if (index < 0 || index >= list(mode).length)
    throw Error("Challenge index outside bounds");
  return mode === "extras" ? extraReference(index) : courseReferences[index];
}
export const rows = (s: OrreryState) => R.arms(s.editor.parts);
export const scroll = (s: OrreryState) => ({
  row: Math.max(
    0,
    rows(s).findIndex((p) => p.id === s.editor.cursor?.part) -
      (C.TAPE_ROWS_VISIBLE - 1),
  ),
  col: Math.max(0, (s.editor.cursor?.col ?? 0) - (C.TAPE_COLS_VISIBLE - 1)),
});
export const menuCount = (s: OrreryState) =>
  s.screen === "title"
    ? C.TITLE_ITEMS.length
    : s.screen === "howto"
      ? 1
      : s.screen === "select"
        ? list(s.mode).length
        : s.sim?.status === "complete"
          ? s.challengeRef && s.challengeRef.index < list(s.mode).length - 1
            ? 3
            : 2
          : 0;
export function menuRect(s: OrreryState, i: number) {
  if (i < 0 || i >= menuCount(s)) return null;
  if (s.screen === "select") {
    const step = Math.min(43, 480 / list(s.mode).length);
    return { x: 260, y: 150 + i * step, w: 760, h: step - 3 };
  }
  if (s.screen === "howto") return { x: 80, y: 625, w: 300, h: 44 };
  if (s.screen === "editor") return { x: 458, y: 360 + i * 48, w: 370, h: 42 };
  return { x: 100, y: 370 + i * 64, w: 350, h: 52 };
}
export function take(s: OrreryState): OrreryState {
  if (s.screen === "title") {
    const n = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? screen(n, "howto")
      : screen(
          { ...n, mode: s.menuIndex === 0 ? "campaign" : "extras" },
          "select",
        );
  }
  if (s.screen === "howto") return screen(s, "title");
  if (s.screen === "select")
    return s.mode === "campaign" && s.selectIndex >= s.unlockedCount
      ? s
      : open(s, s.mode, s.selectIndex, true);
  if (s.sim?.status === "complete") {
    const full = menuCount(s) === 3,
      i = s.menuIndex + (full ? 0 : 1);
    if (i === 0)
      return open(screen(s, "select"), s.mode, s.challengeRef!.index + 1, true);
    if (i === 1) return { ...s, sim: null };
    return screen(s, "select");
  }
  return s;
}
export function pointer(
  s: OrreryState,
  type: "down" | "move" | "up",
  x: number,
  y: number,
  allowTake = true,
): OrreryState {
  let n = {
    ...s,
    pointer: {
      x,
      y,
      down: type === "down" ? true : type === "up" ? false : s.pointer.down,
    },
  };
  if (menuCount(s)) {
    let hit = -1;
    for (let i = 0; i < menuCount(s); i++) {
      const r = menuRect(s, i)!;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) hit = i;
    }
    if (hit >= 0)
      n = {
        ...n,
        ...(s.screen === "select" ? { selectIndex: hit } : { menuIndex: hit }),
      };
    if (type === "down") n = { ...n, menuPress: hit };
    if (type === "up") {
      if (allowTake && s.pointer.down && hit >= 0 && s.menuPress === hit)
        n = take(n);
      n = { ...n, menuPress: null };
    }
    return n;
  }
  if (s.screen !== "editor") return n;
  const h = R.target(x, y);
  if (type === "down") {
    const focus = x >= C.TRAY_REGION_W && y >= C.TAPE_Y0 ? "tape" : "field";
    n = { ...n, editor: { ...n.editor, focus } };
    if (s.sim) return n;
    if (focus === "tape") {
      const sc = scroll(n),
        row = rows(n)[Math.floor((y - C.TAPE_Y0) / C.TAPE_ROW_H) + sc.row];
      if (row) {
        const col =
          x < C.TRAY_REGION_W + C.TAPE_X0
            ? 0
            : Math.floor((x - C.TRAY_REGION_W - C.TAPE_X0) / C.TAPE_CELL_W) +
              sc.col;
        n = {
          ...n,
          editor: {
            ...n.editor,
            cursor: { part: row.id, col },
            selected: row.id,
          },
        };
      }
      return n;
    }
    if (x >= C.TRAY_X0 && x < C.TRAY_X0 + C.TRAY_W) {
      const entry = tray(s)[Math.floor((y - C.TRAY_Y0) / C.TRAY_SLOT_H)];
      if (
        entry &&
        !s.editor.parts.some(
          (p) =>
            ["rise", "set"].includes(entry.kind) &&
            p.kind === entry.kind &&
            p.index === entry.index,
        )
      )
        n = {
          ...n,
          editor: {
            ...n.editor,
            drag: {
              kind: "place",
              part: entry.kind,
              index: entry.index,
              rotation: 0,
              length: 1,
              at: h,
              before: s.editor.parts,
            },
          },
        };
      return n;
    }
    if (
      x >= C.TRAY_REGION_W &&
      x < C.READOUT_X0 &&
      y >= C.HEADING_H &&
      y < C.TAPE_Y0
    ) {
      const p = h
        ? [...s.editor.parts]
            .reverse()
            .sort(
              (a, b) =>
                Number(R.mechanism(b.kind)) - Number(R.mechanism(a.kind)),
            )
            .find((p) => R.footprint(p, s.challenge!).some((x) => R.same(x, h)))
        : null;
      n = {
        ...n,
        editor: {
          ...n.editor,
          selected: p?.id ?? null,
          cursor: p?.tape ? { part: p.id, col: 0 } : n.editor.cursor,
          drag:
            p && h
              ? {
                  kind: "move",
                  part: p.id,
                  from: h,
                  at: h,
                  rotation: p.rotation,
                  length: p.length,
                  before: s.editor.parts,
                }
              : null,
        },
      };
      if (
        p?.kind === "track" &&
        !p.closed &&
        h &&
        (R.same(h, p.cells![0]) || R.same(h, p.cells![p.cells!.length - 1]))
      )
        n = {
          ...n,
          editor: {
            ...n.editor,
            drag: {
              kind: "lay",
              part: p.id,
              end:
                p.cells!.length > 1 && R.same(h, p.cells![0])
                  ? "first"
                  : "last",
              before: s.editor.parts,
            },
          },
        };
    }
    return n;
  }
  const d = n.editor.drag;
  if (!d) return n;
  if (d.kind === "lay") {
    if (type === "move" && h) {
      const p = n.editor.parts.find((p) => p.id === d.part)!;
      const cells = [...p.cells!];
      if (d.end === "first") cells.reverse();
      if (cells.length > 1 && R.same(h, cells[cells.length - 2])) cells.pop();
      else if (R.adjacent(h, cells[cells.length - 1])) {
        if (R.same(h, cells[0]) && cells.length >= 3) {
          n = change(n, p.id, (p) => ({ ...p, closed: true }));
          return {
            ...n,
            editor: {
              ...n.editor,
              drag: null,
              undo: [...n.editor.undo, d.before],
              redo: [],
            },
          };
        }
        if (!cells.some((c) => R.same(c, h))) cells.push(h);
      }
      if (d.end === "first") cells.reverse();
      try {
        n = change(n, p.id, (p) => ({
          ...p,
          cells,
          q: cells[0].q,
          r: cells[0].r,
        }));
      } catch {
        /* An illegal lay leaves the end in place. */
      }
    }
    if (type === "up")
      n = {
        ...n,
        editor: {
          ...n.editor,
          drag: null,
          undo:
            JSON.stringify(n.editor.parts) !== JSON.stringify(d.before)
              ? [...n.editor.undo, d.before]
              : n.editor.undo,
          redo: [],
        },
      };
    return n;
  }
  n = { ...n, editor: { ...n.editor, drag: { ...d, at: h } } };
  if (type !== "up") return n;
  if (h)
    try {
      if (d.kind === "place") {
        n = place(n, d.part, h.q, h.r, d.rotation, d.index);
        n = change(n, n.editor.nextId - 1, (p) => ({ ...p, length: d.length }));
        n = {
          ...n,
          editor: {
            ...n.editor,
            selected: n.editor.nextId - 1,
            cursor: n.editor.parts[n.editor.parts.length - 1].tape
              ? { part: n.editor.nextId - 1, col: 0 }
              : n.editor.cursor,
          },
        };
      } else
        n = change(n, d.part, (p) => ({
          ...p,
          q: p.q + h.q - d.from.q,
          r: p.r + h.r - d.from.r,
          rotation: d.rotation,
          length: d.length,
          cells:
            p.cells?.map((c) => ({
              q: c.q + h.q - d.from.q,
              r: c.r + h.r - d.from.r,
            })) ?? null,
        }));
    } catch {
      n = { ...n, editor: { ...n.editor, parts: d.before } };
    }
  if (
    d.kind === "move" &&
    (!h || JSON.stringify(n.editor.parts) === JSON.stringify(d.before))
  ) {
    try {
      n = change(n, d.part, (p) => ({
        ...p,
        rotation: d.rotation,
        length: d.length,
      }));
    } catch {
      /* An illegal orientation leaves the rest pose intact. */
    }
  }
  const changed = JSON.stringify(n.editor.parts) !== JSON.stringify(d.before);
  return {
    ...n,
    editor: {
      ...n.editor,
      drag: null,
      undo: changed ? [...n.editor.undo, d.before] : n.editor.undo,
      redo: changed ? [] : n.editor.redo,
    },
  };
}
export function key(s: OrreryState, a: C.ActionName): OrreryState {
  if (s.editor.drag && a === "back") return s;
  if (a === "back") {
    if (s.screen === "editor")
      return s.sim ? { ...s, sim: null } : screen(s, "select");
    if (s.screen === "select" || s.screen === "howto")
      return screen(s, "title");
    return s;
  }
  if (menuCount(s)) {
    const count = menuCount(s);
    if (a === "confirm") return take(s);
    if (a === "up" || a === "down") {
      const v =
        ((s.screen === "select" ? s.selectIndex : s.menuIndex) +
          (a === "down" ? 1 : -1) +
          count) %
        count;
      return {
        ...s,
        ...(s.screen === "select" ? { selectIndex: v } : { menuIndex: v }),
      };
    }
    if (s.screen === "howto" && (a === "left" || a === "right"))
      return {
        ...s,
        howtoPage: Math.max(
          0,
          Math.min(C.HOWTO_PAGES - 1, s.howtoPage + (a === "right" ? 1 : -1)),
        ),
      };
    return s;
  }
  if (s.screen !== "editor") return s;
  const ed = s.editor,
    d = ed.drag;
  if (d) {
    if (d.kind === "lay") return s;
    let rotation = d.rotation,
      length = d.length;
    const kind =
      d.kind === "place"
        ? d.part
        : s.editor.parts.find((p) => p.id === d.part)!.kind;
    if (kind !== "track" && a === "part-cw") rotation = R.mod(rotation + 1);
    if (kind !== "track" && a === "part-ccw") rotation = R.mod(rotation - 1);
    if (R.mechanism(kind) && kind !== "wheel" && a === "part-grow")
      length = Math.min(C.ARM_MAX_LEN, length + 1);
    if (R.mechanism(kind) && kind !== "wheel" && a === "part-shrink")
      length = Math.max(C.ARM_MIN_LEN, length - 1);
    return { ...s, editor: { ...ed, drag: { ...d, rotation, length } } };
  }
  if (a === "play" || a === "step") {
    if (!s.sim) {
      if (
        tray(s)
          .filter((t) => ["rise", "set"].includes(t.kind))
          .some(
            (t) =>
              !ed.parts.some((p) => p.kind === t.kind && p.index === t.index),
          )
      )
        return s;
      const n = R.start(s);
      return a === "step" && n.sim?.status === "running"
        ? { ...n, sim: { ...n.sim, status: "paused" } }
        : n;
    }
    if (!["running", "paused"].includes(s.sim.status)) return s;
    if (a === "play")
      return {
        ...s,
        sim: {
          ...s.sim,
          status: s.sim.status === "running" ? "paused" : "running",
        },
      };
    const n = R.advance(
      { ...s, sim: { ...s.sim, status: "running" } },
      1 - s.sim.fraction,
    );
    return n.sim?.status === "running"
      ? { ...n, sim: { ...n.sim, status: "paused" } }
      : n;
  }
  if (s.sim) {
    if (
      (a === "speed-up" || a === "speed-down") &&
      ["running", "paused"].includes(s.sim.status)
    )
      return {
        ...s,
        sim: {
          ...s.sim,
          speed: Math.max(
            0,
            Math.min(
              C.SPEEDS.length - 1,
              s.sim.speed + (a === "speed-up" ? 1 : -1),
            ),
          ),
        },
      };
    return s;
  }
  if (a === "undo" || a === "redo") {
    const from = a === "undo" ? ed.undo : ed.redo,
      to = a === "undo" ? ed.redo : ed.undo;
    if (!from.length) return s;
    const n = parts(s, from[from.length - 1]);
    return {
      ...n,
      editor: {
        ...n.editor,
        ...(a === "undo"
          ? { undo: from.slice(0, -1), redo: [...to, ed.parts] }
          : { redo: from.slice(0, -1), undo: [...to, ed.parts] }),
      },
    };
  }
  if (ed.focus === "field" && ed.selected !== null) {
    try {
      if (a === "part-delete")
        return parts(
          s,
          ed.parts.filter((p) => p.id !== ed.selected),
          true,
        );
      return change(
        s,
        ed.selected,
        (p) => ({
          ...p,
          rotation:
            a === "part-cw" && p.kind !== "track"
              ? R.mod(p.rotation + 1)
              : a === "part-ccw" && p.kind !== "track"
                ? R.mod(p.rotation - 1)
                : p.rotation,
          length:
            !R.mechanism(p.kind) || p.kind === "wheel"
              ? 1
              : a === "part-grow"
                ? Math.min(C.ARM_MAX_LEN, p.length + 1)
                : a === "part-shrink"
                  ? Math.max(C.ARM_MIN_LEN, p.length - 1)
                  : p.length,
        }),
        true,
      );
    } catch {
      return s;
    }
  }
  if (ed.focus === "tape" && ed.cursor) {
    const cur = ed.cursor,
      rs = rows(s),
      idx = rs.findIndex((p) => p.id === cur.part),
      p = rs[idx];
    if (!p) return s;
    if (["left", "right", "up", "down"].includes(a))
      return {
        ...s,
        editor: {
          ...ed,
          cursor: {
            part:
              a === "up" || a === "down"
                ? rs[(idx + (a === "up" ? -1 : 1) + rs.length) % rs.length].id
                : cur.part,
            col:
              a === "left"
                ? Math.max(0, cur.col - 1)
                : a === "right"
                  ? cur.col + 1
                  : cur.col,
          },
        },
      };
    const map: Partial<Record<C.ActionName, TapeCell>> = {
      "ins-grab": "grab",
      "ins-drop": "drop",
      "ins-rotate-cw": "rotate-cw",
      "ins-rotate-ccw": "rotate-ccw",
      "ins-pivot-cw": "pivot-cw",
      "ins-pivot-ccw": "pivot-ccw",
      "ins-extend": "extend",
      "ins-retract": "retract",
      "ins-advance": "advance",
      "ins-recede": "recede",
      "ins-blank": null,
    };
    let entries: TapeCell[] = [];
    let col = cur.col,
      next = col;
    if (a in map) {
      entries = [map[a]!];
      next = col + (a === "ins-blank" ? 0 : 1);
    } else if (a === "ins-erase" && col > 0) {
      col--;
      entries = [null];
      next = col;
    } else if (a === "ins-repeat") {
      entries = p.tape!.slice(0, col);
      while (entries.length < col) entries.push(null);
      next = col + entries.length;
    } else if (a === "ins-reset") {
      let rotation = p.rotation,
        len = p.length;
      const track = ed.parts.find(
        (t) => t.kind === "track" && t.cells!.some((h) => R.same(h, p)),
      );
      const restCell = track?.cells!.findIndex((h) => R.same(h, p)) ?? 0;
      let cell = restCell;
      for (const c of p.tape!.slice(0, col)) {
        if (track && (c === "advance" || c === "recede")) {
          const next = cell + (c === "advance" ? 1 : -1),
            count = track.cells!.length;
          cell = track.closed
            ? (next + count) % count
            : Math.max(0, Math.min(count - 1, next));
        }
        if (c === "rotate-cw") rotation = R.mod(rotation + 1);
        if (c === "rotate-ccw") rotation = R.mod(rotation - 1);
        if (c === "extend") len = Math.min(C.ARM_MAX_LEN, len + 1);
        if (c === "retract") len = Math.max(C.ARM_MIN_LEN, len - 1);
      }
      if (p.kind !== "wheel") entries.push("drop");
      while (len !== p.length) {
        entries.push(len > p.length ? "retract" : "extend");
        len += len > p.length ? -1 : 1;
      }
      const delta = R.mod(p.rotation - rotation);
      for (let i = 0; i < Math.min(delta, 6 - delta); i++)
        entries.push(delta <= 3 ? "rotate-cw" : "rotate-ccw");
      if (track && p.kind !== "wheel") {
        const count = track.cells!.length;
        const forward = track.closed
          ? (restCell - cell + count) % count
          : restCell - cell;
        const backward = track.closed
          ? (cell - restCell + count) % count
          : cell - restCell;
        const advance = forward >= 0 && (backward < 0 || forward <= backward);
        for (let j = 0; j < (advance ? forward : backward); j++)
          entries.push(advance ? "advance" : "recede");
      }
      next = col + entries.length;
    }
    let n = s;
    for (const [i, ins] of entries.entries()) n = write(n, p.id, col + i, ins);
    if (entries.length)
      n = {
        ...n,
        editor: {
          ...n.editor,
          cursor: { part: p.id, col: next },
          undo:
            JSON.stringify(n.editor.parts) !== JSON.stringify(ed.parts)
              ? [...ed.undo, ed.parts]
              : ed.undo,
          redo: [],
        },
      };
    return n;
  }
  return s;
}
export type ChallengeDocument = Challenge;
