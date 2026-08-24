---
"@implementjs/ui": patch
---

The registry now asks for the implement packages its components import by version
rather than by the `latest` tag. `@jsrepo/pnpm` resolves the `workspace:` ranges at
build time, so a component published in this release pulls in the release of
`@implementjs/lucide` it was built against — `~0.0.6` today — instead of whatever
`latest` happens to point at when someone runs `jsrepo add`.
