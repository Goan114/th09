# TH09 portable

This repository contains the source-only TH09 1.50a C++/SDL3 portable and Web implementation.

## Layout

- `th09_web/`: TH09 game, SDL runtime, documentation, and source tests.
- `th10_web/launcher/`: the shared browser launcher and package subsystem used by TH09.
- `portable/`: shared SDL renderer and input code.
- `tools/`: the pinned Emscripten installer metadata.

## Build

Install the pinned toolchain, then build from `th09_web/`:

```powershell
python tools/download-emscripten.py
npm run web:build
```

Build outputs are written below `th09_web/artifacts/` and are intentionally not tracked.

## Assets and licensing

This repository does not track the original Touhou executable, data, music, replay, save files, extracted retail assets, or bundled development toolchains. A runnable package must be assembled locally from files you are legally allowed to use.

Licensing is component-specific. Keep the notices and licenses beside each bundled component; no blanket license is asserted for the original game or its assets.
