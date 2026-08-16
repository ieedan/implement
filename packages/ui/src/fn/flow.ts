/**
 * Lazy control flow.
 *
 * Every dynamic region owns a comment marker in the DOM and mounts its
 * content before it. The marker replaces the `getFirstDomNode` /
 * `getInsertBeforeNode` sibling walk from mountable.ts: an inactive branch has
 * no constructed children to walk, so anchoring must be a real node — and once
 * it is, logical-tree bookkeeping (parentNode links, `adopt`) disappears.
 *
 * Branches and rows are `Child` thunks realized on activation and disposed on
 * deactivation: an `If`'s dialog is not built until it opens, and reopening
 * builds it fresh (PAPERCUTS.md #6).
 */

import equal from "fast-deep-equal";
import { isReadable, subscribeTracked, type Readable } from "../signal";
import type { Unsubscribe } from "../types";
import { signal, type WritableSignal } from "./reactive";
import { captureEnv, runInScope, withEnv } from "./scope";
import {
	mountRegion,
	realize,
	unmountRegion,
	watchProp,
	type ActiveRegion,
	type Child,
	type View,
} from "./view";

type Condition = boolean | Readable<unknown> | (() => unknown);

function toConditionGetter(condition: Condition): () => boolean {
	if (typeof condition === "function") return () => Boolean(condition());
	if (isReadable(condition)) return () => Boolean(condition.get());
	return () => condition;
}

export interface IfBuilder extends View {
	Then(...children: Child[]): this;
	ElseIf(condition: Condition): this;
	Else(...children: Child[]): this;
}

/**
 * `If(open).Then(CreateIssueDialog)` — pass the component function itself (or
 * any thunk); it is not called until the condition first holds.
 */
export function If(condition: Condition): IfBuilder {
	const branches: Array<{ when: () => boolean; children: Child[] }> = [
		{ when: toConditionGetter(condition), children: [] },
	];
	let elseChildren: Child[] = [];

	let host: HTMLElement | null = null;
	let marker: Comment | null = null;
	let unsubscribe: Unsubscribe | null = null;
	let active: ActiveRegion | null = null;
	let showing: number | "else" | null = null;

	return {
		Then(...children) {
			branches[branches.length - 1]!.children = children;
			return this;
		},
		ElseIf(condition) {
			branches.push({ when: toConditionGetter(condition), children: [] });
			return this;
		},
		Else(...children) {
			elseChildren = children;
			return this;
		},

		mount(parent, before = null) {
			if (marker) return;
			host = parent;
			marker = document.createComment("if");
			parent.insertBefore(marker, before);
			// context env at mount time, restored around late branch activations
			const env = captureEnv();

			unsubscribe = subscribeTracked(
				() => branches.findIndex((branch) => branch.when()),
				(index) => {
					const target = index === -1 ? "else" : index;
					if (showing === target) return;

					if (active) {
						unmountRegion(active);
						active = null;
					}

					showing = target;
					const children = target === "else" ? elseChildren : branches[target]!.children;
					active = withEnv(env, () => mountRegion(children, host!, marker));
				},
			);
		},

		unmount() {
			unsubscribe?.();
			unsubscribe = null;
			if (active) {
				unmountRegion(active);
				active = null;
			}
			showing = null;
			marker?.remove();
			marker = null;
			host = null;
		},
	};
}

type ItemsInput<T> = readonly T[] | Readable<readonly T[]> | (() => readonly T[]);

type Row<T> = {
	start: Comment;
	end: Comment;
	view: View;
	dispose: () => void;
	entry: WritableSignal<[T, number]>;
	value: T;
	index: number;
};

function teardownRow<T>(row: Row<T>): void {
	row.view.unmount();
	row.dispose();
	row.start.remove();
	row.end.remove();
}

function moveRange(parent: HTMLElement, start: Node, end: Node, before: Node): void {
	const nodes: Node[] = [];
	for (let node: Node | null = start; node; node = node.nextSibling) {
		nodes.push(node);
		if (node === end) break;
	}
	for (const node of nodes) {
		parent.insertBefore(node, before);
	}
}

/**
 * Keyed list. The key is an explicit function of the item — in the lazy model
 * we refuse to construct a row just to discover its key and throw it away
 * (which is what the eager ForEach does on every update, see MISSING.md #11's
 * closing note). Rows realize once per key, get patched through their entry
 * signal, and move as DOM ranges delimited by their marker pair.
 */
export function ForEach<T>(
	items: ItemsInput<T>,
	key: (item: T, index: number) => string | number,
	render: (entry: Readable<[T, number]>) => Child,
): View {
	let marker: Comment | null = null;
	let unsubscribe: Unsubscribe | null = null;
	const rows = new Map<string, Row<T>>();

	return {
		mount(parent, before = null) {
			if (marker) return;
			const end = (marker = document.createComment("each"));
			parent.insertBefore(end, before);
			const env = captureEnv();

			unsubscribe = watchProp<readonly T[]>(items, (list) => {
				const seen = new Set<string>();
				const ordered: Row<T>[] = [];

				for (let i = 0; i < list.length; i++) {
					const item = list[i]!;
					const rowKey = String(key(item, i));
					if (seen.has(rowKey)) {
						throw new Error(`Duplicate key in ForEach: ${rowKey}`);
					}
					seen.add(rowKey);

					let row = rows.get(rowKey);
					if (row) {
						if (!equal(row.value, item) || row.index !== i) {
							row.value = item;
							row.index = i;
							row.entry.set([item, i]);
						}
					} else {
						const start = document.createComment("row");
						const rowEnd = document.createComment("/row");
						parent.insertBefore(start, end);
						parent.insertBefore(rowEnd, end);

						const entry = signal<[T, number]>([item, i]);
						const [view, dispose] = withEnv(env, () => {
							const realized = runInScope(() => realize(render(entry)));
							realized[0].mount(parent, rowEnd);
							return realized;
						});

						row = { start, end: rowEnd, view, dispose, entry, value: item, index: i };
						rows.set(rowKey, row);
					}
					ordered.push(row);
				}

				for (const [rowKey, row] of rows) {
					if (!seen.has(rowKey)) {
						teardownRow(row);
						rows.delete(rowKey);
					}
				}

				// walk desired order backwards, moving each row's range up to its cursor
				let cursor: Node = end;
				for (let i = ordered.length - 1; i >= 0; i--) {
					const row = ordered[i]!;
					if (row.end.nextSibling !== cursor) {
						moveRange(parent, row.start, row.end, cursor);
					}
					cursor = row.start;
				}
			});
		},

		unmount() {
			unsubscribe?.();
			unsubscribe = null;
			for (const row of rows.values()) {
				teardownRow(row);
			}
			rows.clear();
			marker?.remove();
			marker = null;
		},
	};
}

/**
 * Rebuild-on-change region: tears down and re-realizes whenever the watched
 * value changes. Return `null` to render nothing.
 */
export function Key<T>(value: Readable<T> | (() => T), render: (value: T) => Child | null): View {
	let host: HTMLElement | null = null;
	let marker: Comment | null = null;
	let unsubscribe: Unsubscribe | null = null;
	let active: ActiveRegion | null = null;

	return {
		mount(parent, before = null) {
			if (marker) return;
			host = parent;
			marker = document.createComment("key");
			parent.insertBefore(marker, before);
			const env = captureEnv();

			unsubscribe = watchProp(value, (resolved) => {
				if (active) {
					unmountRegion(active);
					active = null;
				}
				const child = withEnv(env, () => render(resolved));
				if (child) {
					active = withEnv(env, () => mountRegion([child], host!, marker));
				}
			});
		},

		unmount() {
			unsubscribe?.();
			unsubscribe = null;
			if (active) {
				unmountRegion(active);
				active = null;
			}
			marker?.remove();
			marker = null;
			host = null;
		},
	};
}

/** Group children without a wrapper element. */
export function Fragment(...children: Child[]): View {
	let active: ActiveRegion | null = null;
	return {
		mount(parent, before = null) {
			if (active) return;
			active = mountRegion(children, parent, before);
		},
		unmount() {
			if (active) {
				unmountRegion(active);
				active = null;
			}
		},
	};
}

/**
 * Code-splitting falls out of the thunk model: a lazily-imported component is
 * just a thunk whose realization is asynchronous.
 *
 * ```ts
 * lazy(() => import("./issue-detail").then((m) => m.IssueDetailView()))
 * ```
 */
export function lazy(load: () => Promise<Child>, placeholder?: Child): View {
	let marker: Comment | null = null;
	let active: ActiveRegion | null = null;
	let generation = 0;

	return {
		mount(parent, before = null) {
			if (marker) return;
			const anchor = (marker = document.createComment("lazy"));
			parent.insertBefore(anchor, before);
			const env = captureEnv();

			if (placeholder) {
				active = mountRegion([placeholder], parent, anchor);
			}

			const current = ++generation;
			void load().then((child) => {
				if (current !== generation) return;
				if (active) {
					unmountRegion(active);
				}
				active = withEnv(env, () => mountRegion([child], parent, anchor));
			});
		},

		unmount() {
			generation++;
			if (active) {
				unmountRegion(active);
				active = null;
			}
			marker?.remove();
			marker = null;
		},
	};
}
