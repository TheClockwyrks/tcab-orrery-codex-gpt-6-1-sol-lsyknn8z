export type Screen = "title" | "howto" | "select" | "editor";

export type Mode = "campaign" | "extras";

export type MoteType =
  | "dust"
  | "nebula"
  | "comet"
  | "nova"
  | "meteor"
  | "mercury"
  | "saturn"
  | "jupiter"
  | "mars"
  | "venus"
  | "luna"
  | "sol"
  | "umbra"
  | "lumen"
  | "aether";

export type PartKind =
  | "arm"
  | "biarm"
  | "triarm"
  | "hexarm"
  | "piston"
  | "wheel"
  | "track"
  | "bind"
  | "manifold"
  | "triune"
  | "sunder"
  | "wane"
  | "mirror"
  | "ascend"
  | "conjoin"
  | "eclipse"
  | "confluence"
  | "dispersion"
  | "void"
  | "rise"
  | "set";

export type Instruction =
  | "grab"
  | "drop"
  | "rotate-cw"
  | "rotate-ccw"
  | "pivot-cw"
  | "pivot-ccw"
  | "extend"
  | "retract"
  | "advance"
  | "recede";

export type TapeCell = Instruction | null;

export type SimStatus = "running" | "paused" | "faulted" | "complete";

export type FaultKind =
  | "collision"
  | "torn"
  | "overextended"
  | "overretracted"
  | "unmounted"
  | "track-end"
  | "impossible";

export type Focus = "field" | "tape";

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export interface PatternFilament {
  readonly a: Hex;
  readonly b: Hex;
  readonly weight: number;
}

export interface Molecule {
  readonly motes: readonly {
    readonly q: number;
    readonly r: number;
    readonly type: MoteType;
  }[];
  readonly filaments: readonly PatternFilament[];
  readonly repeat: {
    readonly vector: Hex;
    readonly link: PatternFilament;
  } | null;
}

export interface Challenge {
  readonly name: string;
  readonly reagents: readonly Molecule[];
  readonly products: readonly Molecule[];
  readonly permitted: readonly PartKind[];
  readonly target: number;
}

export interface PartState {
  readonly id: number;
  readonly kind: PartKind;
  readonly q: number;
  readonly r: number;
  readonly rotation: number;
  readonly length: number;
  readonly cells: readonly Hex[] | null;
  readonly closed: boolean | null;
  readonly index: number | null;
  readonly tape: readonly TapeCell[] | null;
}

export type DragState =
  | {
      readonly kind: "place";
      readonly part: PartKind;
      readonly index: number | null;
      readonly rotation: number;
      readonly length: number;
      readonly at: Hex | null;
      readonly before: readonly PartState[];
    }
  | {
      readonly kind: "move";
      readonly part: number;
      readonly from: Hex;
      readonly at: Hex | null;
      readonly rotation: number;
      readonly length: number;
      readonly before: readonly PartState[];
    }
  | {
      readonly kind: "lay";
      readonly part: number;
      readonly end: "first" | "last";
      readonly before: readonly PartState[];
    };

export interface EditorState {
  readonly parts: readonly PartState[];
  readonly nextId: number;
  readonly selected: number | null;
  readonly focus: Focus;
  readonly cursor: { readonly part: number; readonly col: number } | null;
  readonly drag: DragState | null;
  readonly undo: readonly (readonly PartState[])[];
  readonly redo: readonly (readonly PartState[])[];
}

export interface MoteState {
  readonly id: number;
  readonly q: number;
  readonly r: number;
  readonly type: MoteType;
  readonly wheel: number | null;
}

export interface SimFilament {
  readonly a: number;
  readonly b: number;
  readonly weight: number;
}

export interface Pose {
  readonly part: number;
  readonly rotation: number;
  readonly length: number;
  readonly cell: Hex;
}

export interface Grip {
  readonly part: number;
  readonly spoke: number;
  readonly mote: number;
}

export interface Metrics {
  readonly cost: number;
  readonly cycles: number;
  readonly area: number;
}

export interface SimState {
  readonly status: SimStatus;
  readonly cycle: number;
  readonly fraction: number;
  readonly speed: number;
  readonly motes: readonly MoteState[];
  readonly nextMoteId: number;
  readonly filaments: readonly SimFilament[];
  readonly poses: readonly Pose[];
  readonly grips: readonly Grip[];
  readonly tallies: readonly number[];
  readonly areaHexes: readonly Hex[];
  readonly fault: {
    readonly kind: FaultKind;
    readonly parts: readonly number[];
    readonly motes: readonly number[];
  } | null;
  readonly metrics: Metrics | null;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

export interface OrreryState {
  readonly menuPress?: number | null;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly selectIndex: number;
  readonly howtoPage: number;

  readonly unlockedCount: number;
  readonly campaignSolved: readonly number[];
  readonly extrasSolved: readonly number[];
  readonly campaignRecords: readonly (Metrics | null)[];
  readonly extrasRecords: readonly (Metrics | null)[];
  readonly campaignMachines: readonly (readonly PartState[] | null)[];
  readonly extrasMachines: readonly (readonly PartState[] | null)[];
  readonly campaignLast: number;
  readonly extrasLast: number;

  readonly challenge: Challenge | null;
  readonly challengeRef: { readonly mode: Mode; readonly index: number } | null;
  readonly editor: EditorState;
  readonly sim: SimState | null;

  readonly pointer: PointerState;
  readonly completion: boolean;
  readonly simTime: number;
  readonly muted: boolean;
}
import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import * as E from "./editor";
import * as R from "./rules";
import { debug } from "./debug";
import { takeCues } from "./events";
import { drawFrame, loadVisuals, visualEvents } from "./visuals";
export type OrreryDebugApi = typeof debug;
export const BACKGROUND = "#080f1b";
export const game: Game<OrreryState, OrreryDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    await Promise.all([
      loadVisuals(api),
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
    ]);
    const sources: Record<
      string,
      (s: OrreryState) => string | number | boolean
    > = {
      screen: (s) => s.screen,
      mode: (s) => s.mode,
      challenge: (s) => s.challenge?.name ?? "none",
      source: (s) => s.challengeRef?.mode ?? "custom",
      parts: (s) => s.editor.parts.length,
      cost: (s) => R.cost(s.editor.parts),
      period: (s) => R.period(s.editor.parts),
      status: (s) => s.sim?.status ?? "editing",
      cycle: (s) => s.sim?.cycle ?? 0,
      fraction: (s) => s.sim?.fraction ?? 0,
      speed: (s) => (s.sim ? C.SPEEDS[s.sim.speed] : 0),
      tallies: (s) =>
        s.sim?.tallies.map((n) => `${n}/${s.challenge?.target}`).join(" ") ??
        "none",
      motes: (s) => s.sim?.motes.length ?? 0,
      area: (s) => s.sim?.areaHexes.length ?? 0,
      fault: (s) => s.sim?.fault?.kind ?? "none",
      focus: (s) => s.editor.focus,
      pointer: (s) => `${s.pointer.x.toFixed(0)},${s.pointer.y.toFixed(0)}`,
    };
    for (const [name, source] of Object.entries(sources))
      api.diagnostics.register(name, source);
    return [E.initial(), debug];
  },
  update(state, api, dt) {
    let s: OrreryState = { ...state, simTime: state.simTime + dt };
    const cues = new Set<string>(takeCues());
    api.audio.loop(C.CUES.music);
    let confirmed = false;
    for (const a of C.ACTIONS)
      if (api.input.pressed(a)) {
        if (a === "mute") api.audio.setMuted(!api.audio.muted());
        else {
          if (a === "confirm") confirmed = true;
          const prior = s;
          s = E.key(s, a);
          if (!prior.sim && s.sim) cues.add(C.CUES.start);
        }
      }
    for (const sample of api.input.pointerSamples())
      s = E.pointer(
        s,
        sample.button && sample.button !== "primary" ? "move" : sample.type,
        sample.x,
        sample.y,
        !confirmed,
      );
    if (s.sim?.status === "running")
      s = R.advance(s, dt * C.SPEEDS[s.sim.speed]);
    if (s.editor.parts.length < state.editor.parts.length)
      cues.add(C.CUES.erase);
    else if (
      JSON.stringify(s.editor.parts.map((p) => [p.id, p.q, p.r])) !==
      JSON.stringify(state.editor.parts.map((p) => [p.id, p.q, p.r]))
    )
      cues.add(C.CUES.place);
    if (s.sim?.tallies.some((t, i) => t > (state.sim?.tallies[i] ?? 0)))
      cues.add(C.CUES.constellation);
    if (s.sim?.status === "faulted" && state.sim?.status !== "faulted")
      cues.add(C.CUES.halt);
    if (s.sim?.status === "complete" && state.sim?.status !== "complete")
      cues.add(C.CUES.complete);
    for (const cue of cues) api.audio.play(cue);
    visualEvents(state, s, dt);
    return { ...s, muted: api.audio.muted() };
  },
  render(state, api) {
    drawFrame(state, api.ctx);
  },
};
