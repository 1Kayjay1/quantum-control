# Quantum Control

Quantum Control is a browser-based 3D route-planning and simulation workspace for student autonomous drone challenge prep. It helps a team rebuild the field, test route ideas, simulate realistic drift and timing imperfections, compare route variants, and export a human-readable instruction sheet for manual transfer into the official coding environment.

## Guardrails

- No drone connection or hardware control
- No executable drone code generation
- No direct export into the official competition platform
- Manual, human-readable output only

## Stack

- React + TypeScript + Vite
- React Three Fiber / Three.js for the 3D field and replay view
- Zustand for editor state, undo/redo, and playback
- Dexie / IndexedDB for local-first project persistence
- Vitest for simulation and export tests

## Local Development

```bash
npm install
npm run dev
```

Use `npm run dev:host` if you want a stable localhost URL at `http://127.0.0.1:5173`.

## Running The Built App

Do not open `dist/index.html` directly with `file://...` in the browser. Modern browsers block the built module files and stylesheets from disk, which makes the app appear blank.

After building, serve the `dist` folder through Vite preview instead:

```bash
npm run build
npm run preview:host
```

Then open `http://127.0.0.1:4173`.

## Validation

```bash
npm run lint
npm run test:run
npm run build
```
