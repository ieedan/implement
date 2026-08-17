# Router

Design concepts for a router for ui_v2.

> **Status: implemented** in `packages/ui_v2/src/router/` as **Concept A**
> (the route-tree object, matching the stub in [AIDANS_ROUTER.md](AIDANS_ROUTER.md))
> with typed `href`/`navigate`/`Link` derived from the tree, params as
> `Readable<string>`s patched in place, persistent layouts via outlets, a
> shared location signal, `searchParam`, and a `fallback` option. `Router(...)`
> is a callable factory (not `new`) so the helper itself is a `Mountable` and
> `app.render(router)` works (goal 4). Exercised end to end by
> `demos/tracker-v2`; findings in
> [demos/tracker-v2/PAPER_CUTS.md](demos/tracker-v2/PAPER_CUTS.md) and
> [demos/tracker-v2/MISSING.md](demos/tracker-v2/MISSING.md).

## Goals

1. Type safe parameters — `:id` in a path should surface as a typed value at the render site, and ideally at every link site too.
2. Signals-first — the current location, params, and search params should be `Readable`s so views react to navigation the same way they react to any other state.
3. Match the house style — the framework's control flow is fluent builders (`If().Then()`, `Switch().Case()`, `Await().Then()`). The router should read like it belongs next to them.
4. A router is just a `Mountable` — `app.render(router)` should work, and so should mounting a router deep inside a layout.

---

## Concept A: Route tree object

One nested object describes the whole app. Keys are path segments, `:param` keys declare parameters, and `render` mounts the view for that level. This is the original sketch.

```ts
const router = new Router({
	"/": {
		render: () => HomePage(),
	},
	"/issues": {
		render: () => IssuesPage(),
		":id": {
			render: ({ id }) => IssuePage({ id }), // id: Readable<string>
			"/comments": {
				render: ({ id }) => CommentsPage({ id }),
			},
		},
	},
});

app.render(router);
```

Params accumulate down the tree and are inferred from the keys, so `render` at `/issues/:id/comments` receives `{ id: Readable<string> }` without annotations. Because the full table exists as one value, the router can also derive a fully typed link helper from it:

```ts
router.href("/issues/:id", { id: "42" }); // "/issues/42"
navigate(router.href("/issues/:id", { id: issue.get().id }));
```

**Nested layouts** fall out naturally: a level with both `render` and children treats `render` as the layout and passes the matched child in:

```ts
"/issues": {
	render: (_, child) => IssuesLayout(child), // child: Mountable of the matched sub-route
	":id": { render: ({ id }) => IssuePage({ id }) },
},
```

**Pros**

- The entire route table is a single, greppable, statically analyzable value.
- Typed `href`/`navigate` come for free from `keyof` the tree.
- Easy to add per-level config later (loaders, guards, meta) without new API surface.

**Cons**

- Deeply recursive mapped types; param inference through nesting is the hardest typing work of the four concepts.
- Doesn't read like the rest of the framework — it's config, not a builder chain.
- Code-splitting requires the tree to accept `() => import(...)` values, which complicates the types further.

---

## Concept B: Fluent builder

Routing as a control-flow helper, styled exactly like `Switch`. Paths are flat strings; params are inferred per call site from the template literal type of the path.

```ts
app.render(
	Router()
		.Route("/", () => HomePage())
		.Route("/issues", () => IssuesPage())
		.Route("/issues/:id", ({ id }) => IssuePage({ id })) // { id: Readable<string> } inferred from the string
		.Route("/issues/:id/comments/:commentId", ({ id, commentId }) => Comment({ id, commentId }))
		.NotFound(() => Div("Nothing here")),
);
```

`Route("/issues/:id", ...)` uses a template-literal type (`ParamsOf<"/issues/:id"> = { id: string }`) so the callback's argument is fully typed with zero registration ceremony. First matching route wins, like `Switch.Case`.

**Nested layouts** via a scoped chain — a `Layout` opens a sub-chain whose routes render inside it (paths relative to the layout prefix, prefix params inherited):

```ts
Router()
	.Route("/", () => HomePage())
	.Layout(
		"/issues",
		(child) => IssuesLayout(child),
		(issues) => issues.Route("/", () => IssuesIndex()).Route("/:id", ({ id }) => IssuePage({ id })),
	)
	.NotFound(() => NotFoundPage());
```

> Considered and rejected: a flat `.Layout(...).Route(...).End()` form where the chain itself shifts into layout scope. It reads closer to `Switch`, but needs an explicit `.End()` to disambiguate where the layout stops (otherwise root routes after a layout and `.NotFound()` ownership are ambiguous), and deep nesting leaves matching `.End()`s tracked by indentation alone. The callback makes the scope a real lexical scope — the language tracks the nesting instead of the reader.

**Pros**

- Reads like `Switch`/`Await` — clearly the same framework.
- Param typing is the easy, well-trodden template-literal trick; no recursive object types.
- Trivial to code-split: `.Route("/settings", () => Await(import("./settings")).Then(m => m.SettingsPage()))`.

**Cons**

- No global route table, so `href("/issues/:id", ...)` can't be typed against "routes that actually exist" — typed links need Concept D's route objects layered on top.
- A long flat chain gets unwieldy for big apps; `Layout` sub-chains help but add nesting back.

---

## Concept C: Routes as components in the tree

No central router at all. The location is a `Readable<Location>` provided through `Context`, and `Route` is just another helper you drop anywhere in the tree — like `If`, but matching on the URL. Matching a parent prefix provides the remaining path to descendants, so nesting is literal component nesting.

```ts
app.render(
	Shell(
		Sidebar(),
		Route("/issues").Render(() =>
			IssuesLayout(
				Route("/").Render(() => IssuesIndex()),
				Route("/:id").Render(({ id }) => IssuePage({ id })),
			),
		),
		Route("/settings").Render(() => SettingsPage()),
		Route.NotFound(() => NotFoundPage()),
	),
);
```

Because routes are ordinary children, layouts are not a feature — they're just the elements you wrapped the `Route` in. A feature module can ship its own routes and the app composes them by mounting the component.

**Pros**

- Zero new mental model: routing is control flow, and control flow already lives in the tree.
- Layouts, guards, and transitions are just wrapping — `If(isAuthed).Then(Route(...)).Else(LoginPage())`.
- Best story for large apps split by feature: each feature owns its routes.

**Cons**

- No global table → no typed `href`, no "list all routes", harder 404 handling (`Route.NotFound` needs sibling-awareness through context, which is subtle).
- Matching is distributed, so two siblings can both match unless the API enforces first-match ordering.
- Easiest to misuse: a `Route` buried under an `If` silently disappears from the URL space.

---

## Concept D: First-class route objects

Routes are standalone typed values, defined before the router exists (TanStack-flavored). Each route knows its full path, its params, and how to print itself — so links, navigation, and matching are all typed end-to-end. The router is just the thing that mounts them.

```ts
// routes.ts — importable from anywhere
const home = route("/");
const issues = route("/issues");
const issue = issues.child("/:id"); // params: { id: string }
const comments = issue.child("/comments"); // inherits { id: string }

// links & navigation are typed against the route, not a string
issue.href({ id: "42" }); // "/issues/42"
issue.Link({ id: "42" }, "Open issue #42"); // renders <a> with intercepted click
issue.go({ id: "42" }); // programmatic navigate

// app.ts — the router binds routes to views
app.render(
	Router()
		.On(home, () => HomePage())
		.On(issues, (_, child) => IssuesLayout(child))
		.On(issue, ({ id }) => IssuePage({ id })) // id: Readable<string>
		.On(comments, ({ id }) => CommentsPage({ id }))
		.NotFound(() => NotFoundPage()),
);

// anywhere in the tree — reactive access to the active route's params
issue.params; // Readable<{ id: string } | null>, null when not matched
issue.isActive; // Readable<boolean>, handy for nav highlighting
```

Data loading composes with the existing `Await` helper instead of a bespoke loader system:

```ts
.On(issue, ({ id }) =>
	Await(id.bind((id) => api.issues.get({ id })))
		.WhileLoading(Spinner())
		.Then((issue) => IssueDetail({ issue }))
		.Catch((error) => ErrorPage({ error })),
)
```

**Pros**

- The only concept where _links_ are as type safe as renders — renaming a path segment breaks every stale `href` at compile time.
- Route values cross module boundaries cleanly; features export their routes, the app wires views.
- `isActive`/`params` as `Readable`s fit the signal model perfectly (nav highlighting, breadcrumbs).

**Cons**

- The most machinery: route identity, child derivation, the `On` registry, and keeping "defined but never mounted" routes from failing silently.
- Two files to touch per new page (route definition + `On` binding) — deliberate separation, but more ceremony than B.

---

## Cross-cutting decisions (apply to any concept)

- **Location as a signal.** One `Readable<{ path: string; search: URLSearchParams; hash: string }>` backed by the History API is the substrate for every concept. Expose it (via `Context` or a module export) so anything can react to navigation.
- **Params are `Readable`s.** Navigating `/issues/1 → /issues/2` should patch `id` in place rather than remount the view — the same policy `Await` uses when a readable promise resolves again. Remount only when the matched route changes.
- **Search params.** A `Writable`-backed view of the query string (`searchParam("filter")` → `Writable<string | null>`) makes `Input({ value: searchParam("q") })` a URL-synced search box for free.
- **`Link` helper.** An `A` wrapper that intercepts clicks, calls `navigate`, and respects modifier keys / `target="_blank"`. In Concept D it hangs off the route object; elsewhere it takes an href.
- **No loader system (yet).** `Await` already covers pending/resolved/rejected; the router only needs to hand params to a render function. Loaders/guards can layer on later.
- **Hash mode / base path** as `Router` options for non-SPA hosting.

## Comparison

|                          | A: tree object  | B: builder              | C: in-tree                  | D: route objects |
| ------------------------ | --------------- | ----------------------- | --------------------------- | ---------------- |
| Typed render params      | ✅ (hard types) | ✅ (easy types)         | ✅ (easy types)             | ✅               |
| Typed links              | ✅              | ❌                      | ❌                          | ✅✅             |
| Matches house style      | ➖              | ✅✅                    | ✅                          | ✅               |
| Nested layouts           | ✅              | ➖ (`Layout` sub-chain) | ✅✅                        | ✅               |
| Feature-module splitting | ➖              | ➖                      | ✅✅                        | ✅               |
| Implementation cost      | High (types)    | Low                     | Medium (context subtleties) | High             |

## Recommendation

Start with **B** for the mounting/matching surface — it's the smallest implementation, the param typing is cheap, and it reads like the existing helpers. Design the internals so **D**'s route objects can layer on top later (`.On(routeObject, render)` alongside `.Route(string, render)`): B gets an app working now, D adds typed links when the framework is ready to pay for them. A's config tree can always be written as a function that _produces_ a B chain, and C's in-tree `Route` can be built later on the same location-context substrate.
