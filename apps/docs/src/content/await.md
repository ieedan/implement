---
title: Await
description: Render from a promise's state with WhileLoading, Then, and Catch — and re-follow promises swapped into a signal.
section: Control flow
order: 10
---

Not all of your data is available synchronously. When your UI depends on a promise, `Await` renders one of three branches from the promise's state:

```ts
import { Await } from "@implementjs/core";

Await(fetchUser(id))
	.WhileLoading(Spinner())
	.Then((user) => Profile(user))
	.Catch((error) => P({ class: "error" }, error.message));
```

- `WhileLoading(...children)` mounts while the promise is pending.
- `Then(render)` mounts when it resolves, with the resolved value.
- `Catch(render)` mounts when it rejects, with the error (normalized to an `Error`).

Every branch is optional and a missing branch renders nothing in that state. If the `Then` render function itself throws, `Await` treats it as a rejection and shows the `Catch` branch.

## Reactive sources: refetching

Pass a `Readable` of a promise and `Await` **re-follows** it whenever a new promise is set. This is the data-fetching pattern. Keep the request in a signal and refetch by swapping the promise:

```ts
const request = signal(api.listIssues());
const refetch = () => request.set(api.listIssues());

Await(request)
	.WhileLoading(Spinner())
	.Then((issues) => IssueList(issues))
	.Catch((error) => RetryCard(error, refetch));
```

With a readable source, `Then` receives a **`Readable<T>`** instead of a raw value. That is what makes refetching seamless. When a new promise resolves while the resolved branch is showing, `Await` patches the readable in place, the branch does **not** remount, and the new data flows through your existing bindings:

```ts
.Then((issues) =>           // issues: Readable<Issue[]>
	ForEach(issues, (i) => i.id, (issue) => IssueRow(issue)),
)
```

State transitions still remount branches (rejected → pending → resolved swap the matching branch in). Only a resolved → resolved value change is patched in place. Stale responses are ignored too. Only the latest followed promise settles the state, so out-of-order fetches can't clobber newer data.

## Refetching on a param change

Combine with `onChange` when the request depends on another signal (a router param, a search query):

```ts
const request = signal(api.fetchIssue(id.get()));

Implement.Lifecycle(
	{ onMount: () => id.onChange((next) => request.set(api.fetchIssue(next))) },
	Await(request)
		.WhileLoading(Spinner())
		.Then((issue) => IssueView(issue)),
);
```

> [!WARNING]
> Avoid `derived([id], (i) => api.fetchIssue(i))` for requests. An unsubscribed derived re-runs its getter on every `get()`, which means duplicate fetches. Keep promises in a plain `signal` and set them explicitly.

## Errors

`Catch` handles promise rejections. Errors thrown synchronously while a branch _mounts_ are a different channel, those route to the nearest [error boundary](/docs/boundary) which we'll cover soon.

Every helper so far updates in place as much as it can. The last one in this part, [Key](/docs/key), is for the times you want the opposite.
