---
"create-implement-app": patch
---

Leaving "Where should we create your app?" empty now creates the app in the current directory, and the CLI asks whether to install dependencies with the detected package manager unless `--install`, `--no-install`, or `--yes` is passed.

Choosing the `ui` addon now installs dependencies and adds the `button` component for you, since the starter page imports it and jsrepo can't run before it is installed. `--no-install` still skips both.
