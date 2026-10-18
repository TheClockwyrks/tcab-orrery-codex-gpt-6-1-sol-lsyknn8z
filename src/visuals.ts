import type { InitApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import * as R from "./rules";
import * as E from "./editor";
import type { OrreryState, PartState, Hex } from "./game";
const ink = "#080f1b",
  panel = "#101b29",
  border = "#2c3b48",
  gold = "#d7b77d",
  muted = "#8598a9",
  white = "#e8e6db",
  cyan = "#81d5d6";
const images = new Map<string, ImageBitmap>();
const systems = new Map<string, ParticleSystem>();
let effects: {
  kind: string;
  x: number;
  y: number;
  age: number;
  player: ParticleCanvasPlayer | null;
}[] = [];
let delta = 0;
export async function loadVisuals(api: InitApi<OrreryState>) {
  const paths = [
    ...Object.values(C.MOTE_SPRITE_PATHS),
    ...Object.values(C.FILAMENT_SPRITE_PATHS),
    ...Object.values(C.SIGIL_GLYPH_PATHS),
    ...Object.values(C.INSTRUCTION_GLYPH_PATHS),
    ...Object.values(C.HUB_PATHS),
    ...Object.values(C.GRIPPER_PATHS),
    C.WHEEL_HUB_PATH,
    C.FIXTURE_MOUNT_PATH,
    ...Object.values(C.APERTURE_SHEETS).flatMap((dir) =>
      Array.from({ length: C.APERTURE_FRAMES }, (_, i) => `${dir}/${i}.png`),
    ),
  ];
  await Promise.all(
    paths.map(async (p) => images.set(p, await api.assets.loadImage(p))),
  );
  await Promise.all(
    Object.entries(C.PARTICLE_PATHS).map(async ([k, p]) =>
      systems.set(
        k,
        JSON.parse(await (await api.assets.load(p)).text()) as ParticleSystem,
      ),
    ),
  );
  effects = [];
}
export function visualEvents(before: OrreryState, s: OrreryState, dt: number) {
  delta = dt;
  effects = effects
    .map((e) => ({ ...e, age: e.age + dt }))
    .filter((e) => e.age < 2);
  if (!s.sim) {
    effects = [];
    return;
  }
  const fire = (kind: string, h: Hex) =>
    effects.push({ kind, ...R.xy(h), age: 0, player: null });
  for (const p of s.editor.parts.filter((p) => p.kind === "set"))
    if ((s.sim.tallies[p.index!] ?? 0) > (before.sim?.tallies[p.index!] ?? 0))
      fire("deliver", p);
  if (s.sim.status === "complete" && before.sim?.status !== "complete")
    fire("complete", { q: 0, r: 0 });
  if (s.sim.status === "faulted" && before.sim?.status !== "faulted") {
    const m = s.sim.motes
      .filter((m) => s.sim!.fault!.motes.includes(m.id))
      .sort((a, b) => R.xy(a).y - R.xy(b).y || R.xy(a).x - R.xy(b).x)[0];
    const p = s.editor.parts.find((p) => s.sim!.fault!.parts.includes(p.id));
    fire("fault", m ?? p ?? { q: 0, r: 0 });
  }
}
function text(
  c: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 14,
  color = white,
  font = "sans-serif",
) {
  c.fillStyle = color;
  c.font = `${size}px ${font}`;
  c.fillText(t, x, y);
}
function line(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  X: number,
  Y: number,
  color = border,
  width = 1,
) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(X, Y);
  c.stroke();
}
function ring(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = gold,
  width = 1,
) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}
function sprite(
  c: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  angle = 0,
  alpha = 1,
) {
  const img = images.get(path);
  if (!img) return;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalAlpha = alpha;
  c.drawImage(img, -img.width / 2, -img.height / 2);
  c.restore();
}
function hex(
  c: CanvasRenderingContext2D,
  h: Hex,
  fill: string,
  stroke = border,
) {
  const { x, y } = R.xy(h);
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const X = x + 27 * Math.cos(a),
      Y = y + 27 * Math.sin(a);
    if (i === 0) c.moveTo(X, Y);
    else c.lineTo(X, Y);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = 1;
  c.stroke();
}
function sky(c: CanvasRenderingContext2D) {
  c.fillStyle = ink;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const g = c.createRadialGradient(690, 290, 10, 690, 290, 650);
  g.addColorStop(0, "#172b3c");
  g.addColorStop(1, ink);
  c.fillStyle = g;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (let i = 0; i < 155; i++) {
    const x = (i * 719 + 31) % C.STAGE_W,
      y = (i * 359 + 19) % C.STAGE_H;
    c.fillStyle = i % 4 === 0 ? "#b8c5c580" : "#6b879750";
    c.fillRect(x, y, i % 11 === 0 ? 2 : 1, 1);
  }
}
function ornament(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  time: number,
) {
  for (let k = 0; k < 4; k++) {
    ring(c, x, y, r - k * 32, k === 0 ? "#87764f80" : "#6a8a9735");
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30 + time * (k % 2 ? 1 : -1) * 0.012;
      const rr = r - k * 32;
      line(
        c,
        x + rr * Math.cos(a),
        y + rr * Math.sin(a),
        x + (rr - (i % 5 === 0 ? 9 : 3)) * Math.cos(a),
        y + (rr - (i % 5 === 0 ? 9 : 3)) * Math.sin(a),
        "#c4b38a40",
      );
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + time * 0.06;
    line(c, x, y, x + r * Math.cos(a), y + r * Math.sin(a), "#9a824e40", 2);
    sprite(
      c,
      C.MOTE_SPRITE_PATHS[C.PLANETS[i]],
      x + (r - 35 - i * 7) * Math.cos(a),
      y + (r - 35 - i * 7) * Math.sin(a),
    );
  }
  sprite(c, C.WHEEL_HUB_PATH, x, y, time * 0.06);
}
function menu(
  c: CanvasRenderingContext2D,
  s: OrreryState,
  labels: readonly string[],
) {
  for (let i = 0; i < labels.length; i++) {
    const r = E.menuRect(s, i);
    if (!r) continue;
    const active = i === (s.screen === "select" ? s.selectIndex : s.menuIndex);
    c.fillStyle = active ? "#b6985b20" : "#0c152080";
    c.fillRect(r.x, r.y, r.w, r.h);
    if (active) {
      c.strokeStyle = gold;
      c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      text(c, "◆", r.x + 17, r.y + r.h / 2 + 5, 12, gold);
    }
    text(
      c,
      labels[i],
      r.x + 43,
      r.y + r.h / 2 + 6,
      s.screen === "select" ? 15 : 16,
      active ? gold : muted,
    );
  }
}
function fieldPart(
  c: CanvasRenderingContext2D,
  p: PartState,
  s: OrreryState,
  ghost = false,
) {
  const center = R.xy(p);
  const pose = s.sim?.poses.find((x) => x.part === p.id);
  const cmd = p.tape?.[(s.sim?.cycle ?? 0) % R.period(s.editor.parts)] ?? null;
  const t = s.sim?.fraction ?? 0;
  let angle = ((pose?.rotation ?? p.rotation) * Math.PI) / 3;
  let len = pose?.length ?? p.length;
  let base = R.xy(pose?.cell ?? p);
  if (pose) {
    if (cmd === "rotate-cw") angle += (t * Math.PI) / 3;
    if (cmd === "rotate-ccw") angle -= (t * Math.PI) / 3;
    if (cmd === "extend") len += t;
    if (cmd === "retract") len -= t;
    if (cmd === "advance" || cmd === "recede") {
      const planned = R.plan(s.sim!, s.editor.parts);
      const next = planned.poses.find((x) => x.part === p.id);
      if (next) {
        const end = R.xy(next.cell);
        base = {
          x: base.x + (end.x - base.x) * t,
          y: base.y + (end.y - base.y) * t,
        };
      }
    }
  }
  if (p.kind === "track") {
    const cells = p.cells!;
    for (let i = 1; i < cells.length; i++) {
      const a = R.xy(cells[i - 1]),
        b = R.xy(cells[i]);
      line(c, a.x, a.y, b.x, b.y, "#34424b", 12);
      line(c, a.x, a.y, b.x, b.y, gold, 2);
    }
    if (p.closed) {
      const a = R.xy(cells[0]),
        b = R.xy(cells[cells.length - 1]);
      line(c, a.x, a.y, b.x, b.y, gold, 2);
    }
    for (const h of [cells[0], cells[cells.length - 1]]) {
      const a = R.xy(h);
      ring(c, a.x, a.y, 6, gold);
    }
    return;
  }
  if (!R.mechanism(p.kind)) {
    for (const [i, h] of R.footprint(p, s.challenge!).entries()) {
      hex(c, h, ghost ? "#62d4cf18" : "#af955315", "#756a4960");
      const a = R.xy(h);
      if (i) ring(c, a.x, a.y, 7, "#bba46d88");
    }
    if (p.kind === "rise" || p.kind === "set") {
      const frame =
        Math.floor(s.simTime / C.APERTURE_FRAME_TIME) % C.APERTURE_FRAMES;
      sprite(
        c,
        `${C.APERTURE_SHEETS[p.kind]}/${frame}.png`,
        center.x,
        center.y,
      );
      const pat = R.pattern(p, s.challenge!)!;
      {
        for (const f of pat.filaments) {
          const a = R.xy(R.add(p, R.rot(f.a, p.rotation))),
            b = R.xy(R.add(p, R.rot(f.b, p.rotation)));
          sprite(
            c,
            C.FILAMENT_SPRITE_PATHS[f.weight === 3 ? "triune" : "plain"],
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
            Math.atan2(b.y - a.y, b.x - a.x),
            0.4,
          );
        }
        for (const m of pat.motes) {
          const a = R.xy(R.add(p, R.rot(m, p.rotation)));
          sprite(
            c,
            C.MOTE_SPRITE_PATHS[m.type],
            a.x,
            a.y,
            0,
            s.sim ? 0.13 : p.kind === "rise" ? 0.7 : 0.25,
          );
        }
      }
      text(
        c,
        `${p.kind === "rise" ? "IN" : "OUT"} ${(p.index ?? 0) + 1}`,
        center.x - 20,
        center.y + 34,
        9,
        p.kind === "rise" ? cyan : gold,
        "monospace",
      );
    } else {
      sprite(
        c,
        C.SIGIL_GLYPH_PATHS[p.kind as keyof typeof C.SIGIL_GLYPH_PATHS],
        center.x,
        center.y,
      );
      text(
        c,
        p.kind.toUpperCase(),
        center.x - 19,
        center.y + 34,
        8,
        muted,
        "monospace",
      );
    }
    return;
  }
  const ds = p.kind === "wheel" ? [0, 1, 2, 3, 4, 5] : R.spokes(p);
  for (const d of ds) {
    const a = angle + (d * Math.PI) / 3,
      x = base.x + Math.cos(a) * C.HEX_PITCH * len,
      y = base.y + Math.sin(a) * C.HEX_PITCH * len;
    line(c, base.x, base.y, x, y, "#090e15", 10);
    line(c, base.x, base.y, x, y, "#9c804f", 6);
    line(c, base.x, base.y - 1, x, y - 1, "#d4c18b", 1);
    if (p.kind !== "wheel")
      sprite(
        c,
        C.GRIPPER_PATHS[
          s.sim?.grips.some(
            (g) =>
              g.part === p.id &&
              g.spoke === R.mod(d + (pose?.rotation ?? p.rotation)),
          )
            ? "closed"
            : "open"
        ],
        x,
        y,
        a,
      );
  }
  sprite(
    c,
    p.kind === "wheel"
      ? C.WHEEL_HUB_PATH
      : C.HUB_PATHS[p.kind === "piston" ? "piston" : "arm"],
    base.x,
    base.y,
    angle,
  );
  if (p.kind === "wheel" && !s.sim)
    for (let d = 0; d < C.WHEEL_MOTES.length; d++) {
      const theta = angle + (d * Math.PI) / 3,
        x = base.x + Math.cos(theta) * C.HEX_PITCH,
        y = base.y + Math.sin(theta) * C.HEX_PITCH;
      sprite(c, C.FIXTURE_MOUNT_PATH, x, y);
      sprite(c, C.MOTE_SPRITE_PATHS[C.WHEEL_MOTES[d]], x, y);
    }
  text(c, `A${p.id + 1}`, base.x - 9, base.y + 4, 10, ink, "monospace");
}
function field(c: CanvasRenderingContext2D, s: OrreryState) {
  c.save();
  c.beginPath();
  c.rect(
    C.TRAY_REGION_W,
    C.HEADING_H,
    C.READOUT_X0 - C.TRAY_REGION_W,
    C.TAPE_Y0 - C.HEADING_H,
  );
  c.clip();
  for (const h of R.hexes) hex(c, h, "#0a16224d", "#263847");
  for (const p of s.editor.parts.filter((p) => !R.mechanism(p.kind)))
    fieldPart(c, p, s);
  for (const p of R.arms(s.editor.parts)) fieldPart(c, p, s);
  if (s.sim) {
    const plan = R.plan(s.sim, s.editor.parts),
      pos = new Map(
        s.sim.motes.map((m) => [
          m.id,
          R.moved(m, plan.motions.get(m.id), s.sim!.fraction),
        ]),
      );
    for (const f of s.sim.filaments) {
      const a = pos.get(f.a),
        b = pos.get(f.b);
      if (a && b)
        sprite(
          c,
          C.FILAMENT_SPRITE_PATHS[f.weight === 3 ? "triune" : "plain"],
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          Math.atan2(b.y - a.y, b.x - a.x),
        );
    }
    for (const m of s.sim.motes) {
      const a = pos.get(m.id)!;
      if (m.wheel !== null) sprite(c, C.FIXTURE_MOUNT_PATH, a.x, a.y);
      sprite(c, C.MOTE_SPRITE_PATHS[m.type], a.x, a.y);
      if (s.sim.fault?.motes.includes(m.id))
        ring(c, a.x, a.y, 24, "#ed8c7c", 2);
    }
  }
  const selected = s.editor.parts.find((p) => p.id === s.editor.selected);
  if (selected) {
    const a = R.xy(selected);
    ring(c, a.x, a.y, 26, gold, 2);
  }
  const d = s.editor.drag;
  if (d && d.kind !== "lay" && d.at) {
    let p =
      d.kind === "place"
        ? R.makePart(-1, d.part, d.at.q, d.at.r, d.rotation, d.index)
        : s.editor.parts.find((p) => p.id === d.part)!;
    if (d.kind === "move")
      p = { ...p, q: p.q + d.at.q - d.from.q, r: p.r + d.at.r - d.from.r };
    p = { ...p, rotation: d.rotation, length: d.length };
    let valid = true;
    try {
      R.legal(
        [
          ...s.editor.parts.filter((b) => d.kind !== "move" || b.id !== d.part),
          p,
        ],
        s.challenge!,
      );
    } catch {
      valid = false;
    }
    c.save();
    c.globalAlpha = 0.6;
    fieldPart(c, p, s, true);
    c.restore();
    const a = R.xy(p);
    ring(c, a.x, a.y, 26, valid ? cyan : "#f78978", 2);
  } else {
    const h = R.target(s.pointer.x, s.pointer.y);
    if (h) {
      const a = R.xy(h);
      ring(c, a.x, a.y, 24, "#81d5d655");
    }
  }
  for (const e of effects) {
    c.save();
    c.translate(e.x - 100, e.y - 100);
    c.scale(200 / c.canvas.width, 200 / c.canvas.height);
    if (!e.player)
      e.player = new ParticleCanvasPlayer(systems.get(e.kind)!, c, {
        clear: false,
        pixelRadius: 1,
        composite: "lighter",
      });
    e.player.update(delta);
    c.restore();
  }
  c.restore();
}
function editor(c: CanvasRenderingContext2D, s: OrreryState) {
  c.fillStyle = panel;
  c.fillRect(0, 0, C.STAGE_W, C.HEADING_H);
  c.fillRect(0, C.HEADING_H, C.TRAY_REGION_W, C.STAGE_H);
  c.fillRect(
    C.READOUT_X0,
    C.HEADING_H,
    C.STAGE_W - C.READOUT_X0,
    C.TAPE_Y0 - C.HEADING_H,
  );
  c.fillRect(
    C.TRAY_REGION_W,
    C.TAPE_Y0,
    C.STAGE_W - C.TRAY_REGION_W,
    C.STAGE_H - C.TAPE_Y0,
  );
  line(c, 0, C.HEADING_H, C.STAGE_W, C.HEADING_H);
  line(c, C.TRAY_REGION_W, C.HEADING_H, C.TRAY_REGION_W, C.STAGE_H);
  line(c, C.READOUT_X0, C.HEADING_H, C.READOUT_X0, C.TAPE_Y0);
  line(c, C.TRAY_REGION_W, C.TAPE_Y0, C.STAGE_W, C.TAPE_Y0);
  text(c, "ORRERY", 20, 30, 18, gold, "Georgia");
  text(c, s.challenge!.name, 250, 30, 20, white, "Georgia");
  text(c, `COST ${R.cost(s.editor.parts)}`, 780, 29, 12, gold, "monospace");
  if (
    !s.sim &&
    E.tray(s).some(
      (t) =>
        ["rise", "set"].includes(t.kind) &&
        !s.editor.parts.some((p) => p.kind === t.kind && p.index === t.index),
    )
  )
    text(c, "Place all rises and sets", 570, 29, 11, muted);
  text(c, "ESC  RETURN     M  SOUND", 1030, 29, 11, muted, "monospace");
  for (const [i, t] of E.tray(s).entries()) {
    const y = C.TRAY_Y0 + i * C.TRAY_SLOT_H;
    const spent =
      ["rise", "set"].includes(t.kind) &&
      s.editor.parts.some((p) => p.kind === t.kind && p.index === t.index);
    c.fillStyle = i % 2 ? "#142130" : "#0c1725";
    c.fillRect(C.TRAY_X0, y, C.TRAY_W, C.TRAY_SLOT_H - 2);
    text(
      c,
      String(i + 1).padStart(2, "0"),
      18,
      y + 19,
      10,
      spent ? "#43515c" : gold,
      "monospace",
    );
    text(
      c,
      t.kind.toUpperCase() + (t.index !== null ? ` ${t.index + 1}` : ""),
      45,
      y + 20,
      12,
      spent ? "#52616d" : white,
    );
    text(
      c,
      spent ? "✓" : String(C.PART_COSTS[t.kind]),
      184,
      y + 20,
      11,
      muted,
      "monospace",
    );
  }
  const bottom = E.tray(s).length * C.TRAY_SLOT_H + C.TRAY_Y0 + 30;
  text(c, "THE WORKBENCH", 20, bottom, 10, gold, "monospace");
  [
    "Drag a part into the sky.",
    "Q / E   turn",
    "W / S   change reach",
    "X       remove",
    "U / I   undo / redo",
  ].forEach((t, i) =>
    text(
      c,
      t,
      20,
      bottom + 25 + i * 22,
      11,
      muted,
      i ? "monospace" : "sans-serif",
    ),
  );
  text(c, "PROGRAM THE HEAVENS", 20, 632, 10, gold, "monospace");
  text(c, "Click a tape cell, then type.", 20, 654, 11, muted);
  text(c, "Space  run / pause", 20, 684, 12, white, "monospace");
  field(c, s);
  const x = C.READOUT_X0 + 24;
  text(c, "OBSERVATORY", x, 84, 11, gold, "monospace");
  text(
    c,
    s.sim ? s.sim.status.toUpperCase() : "ASSEMBLING",
    x,
    116,
    18,
    s.sim?.status === "faulted" ? "#f3a08d" : cyan,
    "Georgia",
  );
  line(c, x, 137, 1250, 137);
  const vals = [
    ["CYCLE", String(s.sim?.cycle ?? 0)],
    ["PERIOD", String(R.period(s.editor.parts))],
    [
      "SPEED",
      `${s.sim ? C.SPEEDS[s.sim.speed] : C.SPEEDS[C.DEFAULT_SPEED_INDEX]} cycles / s`,
    ],
    ["AREA", String(s.sim?.areaHexes.length ?? 0)],
  ];
  for (const [i, [label, v]] of vals.entries()) {
    text(c, label, x, 170 + i * 39, 10, muted, "monospace");
    text(c, v, x + 92, 170 + i * 39, 14, white, "monospace");
  }
  line(c, x, 314, 1250, 314);
  text(c, "DELIVERIES", x, 343, 10, gold, "monospace");
  s.challenge!.products.forEach((p, i) => {
    text(c, `PRODUCT ${i + 1}`, x, 376 + i * 31, 11, muted, "monospace");
    text(
      c,
      `${s.sim?.tallies[i] ?? 0} / ${s.challenge!.target}`,
      x + 126,
      376 + i * 31,
      16,
      cyan,
      "monospace",
    );
    void p;
  });
  text(c, "N  step    , / .  speed", x, 505, 11, muted, "monospace");
  text(
    c,
    s.muted ? "M  sound off" : "M  sound on",
    x,
    530,
    11,
    muted,
    "monospace",
  );
  const sc = E.scroll(s),
    rs = E.rows(s);
  for (let v = 0; v < C.TAPE_ROWS_VISIBLE; v++) {
    const p = rs[v + sc.row],
      y = C.TAPE_Y0 + v * C.TAPE_ROW_H;
    if (!p) continue;
    text(c, `A${p.id + 1}`, 238, y + 19, 12, gold, "monospace");
    text(
      c,
      `${p.tape!.length}/${R.period(s.editor.parts)}`,
      271,
      y + 19,
      9,
      muted,
      "monospace",
    );
    for (let u = 0; u < C.TAPE_COLS_VISIBLE; u++) {
      const col = sc.col + u,
        x = C.TRAY_REGION_W + C.TAPE_X0 + u * C.TAPE_CELL_W;
      const current =
          s.editor.cursor?.part === p.id && s.editor.cursor.col === col,
        play = s.sim && s.sim.cycle % R.period(s.editor.parts) === col;
      c.fillStyle = current ? "#77623b66" : play ? "#35646b66" : "#0a1421";
      c.fillRect(x + 1, y + 2, C.TAPE_CELL_W - 2, C.TAPE_ROW_H - 4);
      if (current) {
        c.strokeStyle = gold;
        c.strokeRect(x + 0.5, y + 1.5, C.TAPE_CELL_W - 1, C.TAPE_ROW_H - 3);
      }
      const ins = p.tape![col];
      if (ins)
        sprite(
          c,
          C.INSTRUCTION_GLYPH_PATHS[ins],
          x + C.TAPE_CELL_W / 2,
          y + C.TAPE_ROW_H / 2,
        );
    }
  }
  if (!rs.length) {
    text(c, "A MACHINE BEGINS WITH AN ARM", 250, 606, 12, gold, "monospace");
    text(
      c,
      "Place an arm, select its tape, and write a repeating sequence.",
      250,
      633,
      13,
      muted,
    );
  }
  text(
    c,
    "G grab   V drop   A / D rotate   Z / C pivot   W / S reach   T / B track   R reset   Y repeat",
    238,
    714,
    10,
    muted,
    "monospace",
  );
  if (s.sim?.status === "faulted") {
    c.fillStyle = "#391c26d0";
    c.fillRect(345, 65, 540, 40);
    text(
      c,
      `MACHINE HALTED · ${s.sim.fault!.kind.toUpperCase()}   /   ESC to edit`,
      365,
      91,
      13,
      "#ffb09c",
      "monospace",
    );
  }
  if (s.sim?.status === "complete") {
    c.fillStyle = "#0c1724c4";
    c.fillRect(405, 183, 470, 355);
    c.strokeStyle = gold;
    c.strokeRect(405.5, 183.5, 470, 355);
    text(c, "✦", 626, 223, 24, gold);
    text(c, C.SOLVED_TITLE_TEXT, 460, 264, 24, gold, "Georgia");
    const m = s.sim.metrics!;
    text(
      c,
      `COST ${m.cost}     CYCLES ${m.cycles}     AREA ${m.area}`,
      456,
      307,
      13,
      white,
      "monospace",
    );
    const rec = s.challengeRef
      ? s[
          s.challengeRef.mode === "campaign"
            ? "campaignRecords"
            : "extrasRecords"
        ][s.challengeRef.index]
      : null;
    text(
      c,
      rec
        ? `BEST  cost ${rec.cost} · cycles ${rec.cycles} · area ${rec.area}`
        : "A new arrangement in the heavens.",
      468,
      333,
      12,
      cyan,
    );
    menu(c, s, E.menuCount(s) === 3 ? C.SOLVED_ITEMS : C.SOLVED_ITEMS.slice(1));
  }
}
const howto = [
  [
    "A sky of possibilities",
    "Every challenge names the constellations you must deliver.",
    "Motes are celestial bodies; filaments join them into rigid constellations.",
    "Cloud, ice, fire and stone are essences. Six planets climb toward Sol.",
    "Mercury is a catalyst; dust, shadow, light and aether complete the sky.",
  ],
  [
    "The instrument shop",
    "Rises bring reagents into the sky. Sets accept matching, unheld products.",
    "Arms carry constellations. Wheels carry fixtures. Tracks carry arms.",
    "Bind joins · manifold branches · triune strengthens · sunder separates.",
    "Wane fades · mirror copies · ascend raises · conjoin combines.",
    "Eclipse splits · confluence gathers · dispersion scatters · void consumes.",
  ],
  [
    "Write the rhythm",
    "Click a tape cell and type G to grab, V to drop, A or D to rotate.",
    "Z and C pivot a constellation; W and S extend or retract a piston.",
    "T and B travel along a track. Arrow keys move the tape cursor.",
    "Delete blanks; Backspace erases; R writes a return; Y repeats the prefix.",
    "Every tape loops together on the length of the longest tape.",
  ],
  [
    "Set the heavens turning",
    "Space starts your machine and toggles pause. N steps one cycle.",
    "The comma and period keys change speed. Escape returns to the bench.",
    "Motes collide during motion, even between hexes. Give them room.",
    "A fault freezes the sky. Read the banner and the marked motes or parts.",
  ],
  [
    "Make something beautiful",
    "Deliver each product six times to complete a challenge.",
    "Cost measures the parts you placed. Cycles measure the time it took.",
    "Area measures every hex your machine touched. Lower is better.",
    "Refine a machine to improve each record independently.",
    "Campaign opens one challenge at a time. Extras are always open.",
  ],
];
export function drawFrame(s: OrreryState, c: CanvasRenderingContext2D) {
  sky(c);
  if (s.screen === "editor") {
    editor(c, s);
    return;
  }
  if (s.screen === "title") {
    ornament(c, 899, 341, 254, s.simTime);
    text(c, "AN ASTRONOMICAL MACHINE SHOP", 103, 152, 12, gold, "monospace");
    text(c, C.TITLE_TEXT, 93, 258, 96, white, "Georgia");
    text(c, C.TAGLINE_TEXT, 103, 305, 15, gold, "monospace");
    line(c, 103, 335, 451, 335, "#86734e");
    menu(c, s, C.TITLE_ITEMS);
    text(c, "Build a mechanism. Write its rhythm.", 104, 620, 15, muted);
    text(c, "Give the stars a place to go.", 104, 646, 15, muted);
    text(c, "↑ ↓  CHOOSE     ENTER  BEGIN", 104, 690, 11, gold, "monospace");
    text(c, "01 / CELESTIAL ENGINEERING", 955, 690, 10, muted, "monospace");
    return;
  }
  if (s.screen === "select") {
    text(c, "ORRERY / " + s.mode.toUpperCase(), 260, 77, 13, gold, "monospace");
    text(
      c,
      s.mode === "campaign"
        ? "The celestial workshop"
        : "Beyond the familiar sky",
      257,
      122,
      34,
      white,
      "Georgia",
    );
    const solved = s.mode === "campaign" ? s.campaignSolved : s.extrasSolved,
      records = s.mode === "campaign" ? s.campaignRecords : s.extrasRecords;
    menu(
      c,
      s,
      E.list(s.mode).map(
        (ch, i) => `${String(i + 1).padStart(2, "0")}    ${ch.name}`,
      ),
    );
    E.list(s.mode).forEach((_, i) => {
      const r = E.menuRect(s, i)!;
      const locked = s.mode === "campaign" && i >= s.unlockedCount;
      const record = records[i];
      text(
        c,
        locked ? "LOCKED" : solved.includes(i) ? "SOLVED" : "OPEN",
        record ? 665 : 900,
        r.y + 25,
        10,
        locked ? "#65717c" : cyan,
        "monospace",
      );
      if (record)
        text(
          c,
          `cost ${record.cost}  cycles ${record.cycles}  area ${record.area}`,
          730,
          r.y + 25,
          10,
          muted,
          "monospace",
        );
    });
    text(
      c,
      "↑ ↓  CHOOSE     ENTER  OPEN     ESC  BACK",
      260,
      665,
      12,
      gold,
      "monospace",
    );
    return;
  }
  const page = howto[s.howtoPage];
  text(c, "THE APPRENTICE’S NOTES", 80, 88, 13, gold, "monospace");
  text(c, page[0], 78, 154, 43, white, "Georgia");
  line(c, 80, 186, 1150, 186);
  if (s.howtoPage === 1) {
    text(
      c,
      "Rises supply reagents. Sets receive exact, unheld products.",
      80,
      220,
      18,
      cyan,
    );
    text(
      c,
      "Arms carry; wheels lend their essences; tracks move the whole mechanism.",
      80,
      250,
      18,
      white,
    );
    const notes: Record<keyof typeof C.SIGIL_GLYPH_PATHS, string> = {
      bind: "Joins two neighboring motes.",
      manifold: "Binds a center to three reaches.",
      triune: "Gives two novas a stronger bond.",
      sunder: "Cuts the filament between two motes.",
      wane: "Fades an essence into dust.",
      mirror: "Copies an essence onto dust.",
      ascend: "Spends mercury to raise a planet.",
      conjoin: "Combines two planets into the next.",
      eclipse: "Turns dust into shadow and light.",
      confluence: "Gathers four essences into aether.",
      dispersion: "Scatters aether into four essences.",
      void: "Consumes a loose, unheld mote.",
    };
    Object.entries(C.SIGIL_GLYPH_PATHS).forEach(([kind, path], i) => {
      const x = i < 6 ? 104 : 674,
        y = 292 + (i % 6) * 51;
      sprite(c, path, x, y);
      text(c, kind.toUpperCase(), x + 35, y - 4, 12, gold, "monospace");
      text(c, notes[kind as keyof typeof notes], x + 35, y + 15, 14, white);
    });
  } else
    page
      .slice(1)
      .forEach((t, i) =>
        text(c, t, 80, 246 + i * 53, 20, i === 0 ? cyan : white),
      );
  text(
    c,
    `${s.howtoPage + 1} / ${C.HOWTO_PAGES}    ← → TURN THE PAGE`,
    80,
    582,
    12,
    gold,
    "monospace",
  );
  menu(c, s, ["BACK TO THE WORKSHOP"]);
}
