---
"create-implement-app": patch
---

Scaffold a `.vscode/extensions.json` recommending `implementjs.implement-vscode`,
so a new app prompts to install the editor extension on first open. Apps created
with the tailwind addon also get `bradlc.vscode-tailwindcss`.

Recommendations only — nothing installs itself, and an editor that does not read
the file ignores it.
