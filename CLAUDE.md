# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A small Asteroids clone built with vanilla JavaScript and the HTML5 Canvas API. No build step, no package manager, no dependencies, no tests — it's three source files loaded directly by the browser.

## Running the game

There is no compilation or dev server required. Just open `index.html` in a browser (Chrome / MS Edge are the only tested targets).

Note: `index.html` references scripts with root-relative paths (`/js/GraphNG.js`, `/js/Asteroids.js`), so opening the file directly via `file://` will fail to load them. Serve the directory over HTTP instead, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

There is no lint, build, or test command in this repo.

## Architecture

Two scripts, loaded in order by `index.html`, collaborate via a single `Asteroids` game instance:

- **`js/GraphNG.js`** — `GraphNG` is a thin rendering wrapper around a `<canvas>` 2D context. It has no knowledge of game logic; it only exposes drawing primitives (`drawPolyline`, `polyfill`, `drawArc`, `arcWithStyle`, `drawText`, `clear`) that take a "style" object (applied via `setStyle`, which just assigns each key onto the canvas context, e.g. `fillStyle`, `strokeStyle`, `globalAlpha`, `shadowBlur`).
- **`js/Asteroids.js`** — all game logic and entities. `index.html` wires the two together:
  ```js
  var graphNg = new GraphNG("myCanvas");
  var game = new Asteroids(graphNg);
  ```
  then `game.start()` is called from `<body onload>`.

### Class hierarchy in Asteroids.js

```
GameObject            - base: coordinates, velocity, radius, screen-wrap move(), calcPoint() (polar->cartesian helper)
  Polygon             - adds a `poly` angle/distance pair list -> recomputed `points` each move(); draw(); point-in-polygon and polygon/polygon collision tests
    DestructibleObject - adds exploded/isActive()/explode() lifecycle used by anything that can be shot
      Ship
      Ufo
      Asteroid
  Bullet              - simple point object with a time-to-live counter instead of poly points
Stars                 - decorative twinkling background, not part of the GameObject hierarchy
```

Key mechanics to know before changing behavior:

- **Shape definition**: Each `Polygon` subclass defines its outline as a flat array of `[angleDegrees, distance, angleDegrees, distance, ...]` pairs relative to its center (see `SHIP_POLY`, `UFO_POLY`, and the procedurally generated poly in `Asteroid`'s constructor). `move()` converts these into absolute `points` via `calcPoint()` every frame.
- **Collision detection**: `Polygon.pointCollision(x, y)` is ray-casting point-in-polygon; `Polygon.polygonCollision(poly)` first does a cheap radius check, then checks if one polygon's first point is inside the other, then checks all edge-pairs for line intersection. Bullets use the cheaper `pointCollision` against asteroids/ship; the ship vs. asteroid check uses full `polygonCollision`.
- **Object pooling for bullets**: `this.bulletArray` is a fixed-size pool (`MAX_BULLETS`) created once in `newGame()`/`demoMode()`. `fire()` scans for an inactive bullet (`active <= 0`) and reuses it rather than allocating — there's no bullet array growth/shrink.
- **Asteroid splitting**: `ASTEROID_CONFIGURATIONS` (keyed by category 1-3) defines radius/complexity/score/velocity/children per tier. `Asteroid.explode()` spawns `children` new `Asteroid`s of `category + 1` at the same coordinates with inherited velocity, until category 3 (0 children) is reached.
- **Game loop**: `Asteroids.animate()` is a manual `move()` -> `draw()` -> `setTimeout(..., 20)` loop (not `requestAnimationFrame`). `move()` handles ship/asteroid/bullet updates, collisions, UFO spawning (`UFO_FREQUENCY` chance per frame), filtering out exploded `destructibleObjects`, respawning the ship on life loss, and advancing to `nextLevel()` when the field is clear.
- **Demo mode**: when lives run out, the game drops into `demoMode()` (`ship = null`, higher asteroid count via `DEMO_LEVEL`) and shows a "Press 'S' to Play" prompt; pressing `S` while `lives === 0` calls `newGame()`.
- **Input**: `keyHandler` in `Asteroids` is bound once in `start()` to `keydown`/`keyup` on `document`. Controls are fixed: A/D rotate, W thrusts, L fires, S starts/restarts (see `index.html` instructions list, which must stay in sync with `keyHandler`).
- **Screen wrapping**: all movement wrapping (ship, asteroids, UFO, bullets) happens in the shared `GameObject.move()` based on `this.graphics.width/height`, which come from the canvas element's `width`/`height` attributes set in `index.html` (currently 1000x800).
