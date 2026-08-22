---
title: Putting It All Together
description: Assemble everything you've learned into a complete application.
section: Building applications
order: 22
---

You've made it through the whole toolbox. Let's put it to work and sketch a real application, a small issue tracker, using nothing you haven't already learned.

## The entry

Every app starts the same way. An `App`, the [HMR block](/docs/vite), and a [router](/docs/router):

```ts
// src/index.ts
import { App } from "@implementjs/core";
import { router } from "./router";

const app = App({ target: document.getElementById("root")! });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

app.render(router);
```

## The route tree

The router describes the whole app in one object. A persistent layout wraps the issue pages, and an [error boundary](/docs/boundary) in the layout means one broken page never takes down the shell:

```ts
// src/router.ts
import {
	ImplementBoundary,
	ImplementDocument,
	ImplementHead,
	ImplementLifecycle,
	Router,
} from "@implementjs/core";

export const router = Router(
	{
		"/": () => Home(),
		"/issues": {
			layout: (child) => Shell(ImplementBoundary(child).Catch(PageError)),
			"/": () => Issues(),
			"/:id": { "/": ({ id }) => Issue(id) },
		},
	},
	{ fallback: () => NotFound() },
);
```

Because the layout is persistent, the sidebar keeps its scroll position while you navigate between issues. Only the page itself swaps.

## Shared state

The current session is needed all over the app, so it goes in a [context](/docs/context) provided at the top:

```ts
type Session = { user: Readable<User>; logout: () => void };

export const SessionContext = context<Session>();

// anywhere below the provider
function UserBadge() {
	return SessionContext.Use(({ user }) => Div({ class: "badge" }, user.bind("name")));
}
```

## Fetching data

Data fetching is the [Await](/docs/await) pattern. Keep the request in a [signal](/docs/signals), refetch by swapping the promise, and refetch on param changes with `onChange` scoped through [Lifecycle](/docs/lifecycle):

```ts
function Issue(id: Readable<string>) {
	const request = signal(api.fetchIssue(id.get()));

	return ImplementLifecycle(
		{ onMount: () => id.onChange((next) => request.set(api.fetchIssue(next))) },
		Await(request)
			.WhileLoading(Spinner())
			.Then((issue) => IssueView(issue))
			.Catch((error) => RetryCard(error, () => request.set(api.fetchIssue(id.get())))),
	);
}
```

Remember the param `id` is a signal, so navigating from `/issues/1` to `/issues/2` doesn't remount this page. The `onChange` swaps in a new request and `Await` re-follows it.

## The page itself

Inside `IssueView` it's all things you know. [Bindings](/docs/bindings) into the issue, [two-way inputs](/docs/signals), a [derived](/docs/derived) here and there, [ForEach](/docs/foreach) for the comment list, and a page [title](/docs/head) that tracks the issue:

```ts
function IssueView(issue: Readable<Issue>) {
	const comments = issue.bind("comments");

	return Article(
		ImplementHead(ImplementHead.Title(issue.bind((i) => `${i.name} — Tracker`))),
		H1(issue.bind("name")),
		P(issue.bind("description")),
		Ul(
			ForEach(
				comments,
				(c) => c.id,
				(comment) => CommentRow(comment),
			),
		),
	);
}
```

## The dialog

Overlays combine [If](/docs/if), [Portal](/docs/portal), and a document listener from [Window & Document](/docs/global-events) that only exists while the dialog is open:

```ts
function NewIssueDialog(open: Signal<boolean>) {
	return If(open).Then(
		Portal(Div({ class: "fixed inset-0 grid place-items-center bg-black/50" }, IssueForm())),
		ImplementDocument({
			onKeydown: (event) => {
				if (event.key === "Escape") open.set(false);
			},
		}),
	);
}
```

And if the form should reset for each record it edits, wrap it in [`Key`](/docs/key).

## Where to go from here

That's the whole framework working together. Now that you've wired an app by hand, know that you don't have to every time — [Kit](/docs/kit) generates the entry and route tree from files in `src/routes`, and adds SSR and prerendering on top.

For unstyled UI building blocks on top of the framework, see [Primitives](/primitives). And if you haven't yet, work through the interactive [tutorial](/tutorial). Building each piece yourself is the fastest way to make it stick.
