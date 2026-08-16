/**
 * Realization scopes.
 *
 * In the lazy model, component thunks are invoked at mount time, so every
 * construction has a *when* and a *where*. A scope collects everything created
 * during one realization (computed subscriptions, effects, user cleanups) and
 * disposes it all when the owning region unmounts. This is what the eager
 * class model cannot offer: there, construction happens "nowhere" (at tree
 * build time), so nothing can own the disposal of a `Derived` made inside a
 * component function (MISSING.md #10).
 */

let currentScope: Array<() => void> | null = null;

/**
 * Register a cleanup with the innermost realization scope. Runs when the
 * region that realized the current thunk unmounts. Outside a scope this is a
 * no-op (the caller owns disposal).
 */
export function onCleanup(cleanup: () => void): void {
	currentScope?.push(cleanup);
}

/**
 * Run `fn` collecting scope cleanups; returns the result and a disposer that
 * runs the collected cleanups (latest first).
 */
export function runInScope<T>(fn: () => T): [T, () => void] {
	const scope: Array<() => void> = [];
	const previous = currentScope;
	currentScope = scope;
	try {
		const value = fn();
		return [
			value,
			() => {
				for (let i = scope.length - 1; i >= 0; i--) scope[i]!();
				scope.length = 0;
			},
		];
	} finally {
		currentScope = previous;
	}
}

/**
 * The context environment: an immutable map of provided values, maintained as
 * a dynamic scope during realization. Pure dynamic scoping is not enough on
 * its own — a branch activated *later* (an `If` flipping true from an event
 * handler) realizes outside its provider's `mount` call — so dynamic regions
 * `captureEnv()` when they mount and restore it with `withEnv()` around every
 * later realization. Capture is O(1): the maps are never mutated, only
 * extended copy-on-provide.
 */
export type ContextEnv = ReadonlyMap<symbol, unknown>;

let currentEnv: ContextEnv = new Map();

export function captureEnv(): ContextEnv {
	return currentEnv;
}

export function withEnv<T>(env: ContextEnv, fn: () => T): T {
	const previous = currentEnv;
	currentEnv = env;
	try {
		return fn();
	} finally {
		currentEnv = previous;
	}
}
