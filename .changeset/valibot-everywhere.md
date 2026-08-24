---
"create-implement-app": patch
"@implementjs/kit": patch
---

Use valibot as the schema library everywhere the docs and templates need one

Kit still takes any [Standard Schema](https://standardschema.dev) — arktype and zod included,
each still converted to JSON Schema through its own package — but every example, doc and
scaffolded file is now written in valibot, which is what `@implementjs/formish` already
required. A scaffolded kit app ships `valibot` as a devDependency in place of `zod`.

Kit's valibot-to-JSON-Schema conversion now runs with `errorMode: "ignore"`, so a schema
carrying a transform is documented as unconstrained instead of dropping the route's
parameters and warning. That matches what the zod converter already did with
`unrepresentable: "any"`.
