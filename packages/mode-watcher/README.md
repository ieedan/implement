[![npm version](https://img.shields.io/npm/v/@implementjs/mode-watcher.svg)](https://www.npmjs.com/package/@implementjs/mode-watcher) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/mode-watcher.svg)](https://www.npmjs.com/package/@implementjs/mode-watcher)

# @implementjs/mode-watcher

Dark mode for [implement](https://implementjs.dev): the visitor's choice, the system
preference, and the class on `<html>`. It is applied before the first paint, so the page
never flashes the wrong theme.

```sh
npm install @implementjs/mode-watcher
```

```ts
import { App, Button } from "@implementjs/core";
import { createModeManager, ModeWatcher } from "@implementjs/mode-watcher";

export const mode = createModeManager();

App({ target: document.body }).render(
	ModeWatcher({ manager: mode }),
	Button({ onClick: () => mode.toggleMode() }, "Toggle theme"),
);
```

`ModeWatcher` renders nothing. It reads the stored choice, falls back to the system
preference, and keeps the `dark` class and `color-scheme` on the document element in step
with the manager.

A port of [mode-watcher](https://github.com/svecosystem/mode-watcher) for implement.

Full documentation: [implementjs.dev/mode-watcher](https://implementjs.dev/mode-watcher)
