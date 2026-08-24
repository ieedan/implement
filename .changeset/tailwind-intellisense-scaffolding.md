---
"create-implement-app": patch
---

Write `.vscode/settings.json` for a tailwind app, so the recommended tailwind extension finds the classes an implement component actually holds — `class:` object properties, the `styles = { ... }` object the generated components keep their classes in, and `cn()`/`tv()` with the `ui` addon.
