/**
 * Context via a captured dynamic environment.
 *
 * Because thunks realize during mount, "who is my provider?" is answerable
 * from an ambient environment: `Provide` extends the env around the
 * realization of its children, and `use()` reads it from inside any component
 * function realizing underneath. The parentNode-walking machinery in
 * mountable.ts/context.ts (adopt links, `hasContext`, `lookupProvided`)
 * becomes unnecessary.
 *
 * Pure dynamic scoping alone would break for late activations — an `If`
 * branch flipping true from an event handler realizes long after `Provide`'s
 * mount returned. So dynamic regions capture the env when they mount and
 * restore it around later realizations (see scope.ts / flow.ts). That also
 * means re-realization re-reads current values, fixing the "Context.Use reads
 * once and never updates" papercut (PAPERCUTS.md #7) for rebuilt subtrees.
 *
 * Constraint to be honest about: `use()` is only valid during realization —
 * call it in the component body and capture the value; calling it later (in
 * an event handler, a timeout) throws.
 */

import { captureEnv, withEnv } from "./scope";
import { mountRegion, unmountRegion, type ActiveRegion, type Child, type View } from "./view";

export interface Context<T> {
	Provide(value: T, ...children: Child[]): View;
	/** Read the nearest provided value; only callable while realizing under a `Provide`. */
	use(): T;
}

export function context<T>(fallback?: { value: T }): Context<T> {
	const key = Symbol();

	return {
		Provide(value, ...children) {
			let active: ActiveRegion | null = null;
			return {
				mount(parent, before = null) {
					if (active) return;
					const env = new Map(captureEnv());
					env.set(key, value);
					active = withEnv(env, () => mountRegion(children, parent, before));
				},
				unmount() {
					if (active) {
						unmountRegion(active);
						active = null;
					}
				},
			};
		},

		use() {
			const env = captureEnv();
			if (env.has(key)) return env.get(key) as T;
			if (fallback) return fallback.value;
			throw new Error("context.use() called outside a matching Provide (or after realization)");
		},
	};
}
