---
"@implementjs/kit": patch
---

Replace the client's `path` style with a `nested` option, and fail loudly when the `neverthrow` style is picked without the package.

`api.client.style` is gone. `api["/api/posts/[id]"].GET(…)` only ever swapped where the route key was typed, so in its place `api.client.nested` builds the client as a tree of the app's own routes:

```ts
// vite.config.ts
kit({ api: { client: { nested: true } } });
```

```ts
const { data, error } = await api.api.posts["[id]"].GET({ params: { id: "1" } });
await api.docs["[...slug].md"].GET({ params: { slug: "guide/install" } });
```

Every level offers only the segments that continue a route, with the methods at the leaf, so a call is reached by autocomplete rather than by typing a whole route key. It composes with all three error styles — `NestedClient` and `ResultNestedClient` replace `PathClient` and `ResultPathClient` — and the seven HTTP method names become reserved segments.

The generated `createClient` now also passes the shape the app configured. It annotated its return type with it but called `create(options)` without it, so an app that had picked `"throw"` or the old `"path"` style got a client that was typed one way and dispatched another.

`errors: "neverthrow"` without `neverthrow` installed used to generate a client whose types silently resolved to nothing — `neverthrow` is an optional peer, and the only sign was `tsc` failing to find a module inside a generated file. Codegen now stops with a message naming the option and what to do about it, and `implement-kit sync` prints that message once rather than repeating it inside the stack it prints after.
