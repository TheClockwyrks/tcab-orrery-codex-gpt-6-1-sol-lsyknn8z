# Orrery

Build celestial machines on a hexagonal workbench. Place arms, wheels, tracks, apertures, and transforming sigils; write looping instruction tapes; deliver constellations without colliding. Sixteen Campaign workshops unlock in order, and ten Extras are available immediately. Each challenge keeps separate session records for cost, cycles, and area.

## Run

```sh
npm ci
npm run dev
```

Open the address Vite prints. The game runs entirely in the browser. Sound unlocks on your first gesture; press **M** to mute.

```sh
npm run build
npm run preview
```

`dist/` is a self-contained static site that can be served at a root or sub-path. The build only bundles committed assets; it needs no asset generation tools or external services.

## Controls

- Menus: arrow keys and Enter, or click/touch an item. Escape returns.
- Build: drag a tray part onto the field. Select and drag to move it.
- Field: **Q/E** rotate, **W/S** change arm reach, **X** remove.
- Tracks: drag from an open end to extend; retrace to shorten; connect the other end to close.
- Tape: click a cell, then **G** grab, **V** drop, **A/D** rotate, **Z/C** pivot, **W/S** extend/retract, **T/B** advance/recede.
- Tape navigation: arrows; **Delete** blanks, **Backspace** erases the previous cell. **R** writes a return sequence; **Y** repeats the prefix.
- **U/I** undo/redo while editing.
- **Space** run/pause, **N** step, **comma/period** change speed. **Escape** stops a run.
- **Backtick** toggles the engine diagnostics.

Progress and machines last for the current session.

## Development

The immutable game state and public debug type are exported from `src/game.ts`. Rules, editor transitions, challenge data, reference machines, and presentation live in separate modules. The engine owns input, timing, loading, audio, canvas fitting, diagnostics, and recording.

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests cover reference runs for all 26 challenges, sampled collision cases, time integration, placement, editor history, and an engine-driven run loading the genuine assets.

All art, animation frames, particle systems, cues, and music are committed under `assets/`. `scripts/produce-assets.py` records the one-time authoring recipe using the development asset tools; it is never invoked by installation or builds. `public/assets` points to those committed files for Vite's static copying. The player-facing presentation and a 16.75-second engine recording are in `showcase/`.
