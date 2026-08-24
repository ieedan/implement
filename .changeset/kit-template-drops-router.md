---
"create-implement-app": patch
---

Drop `@implementjs/router` from the kit template's dependencies. Nothing a kit app writes imports it, and kit now resolves it itself — so the app no longer carries a version of a package it never names.
