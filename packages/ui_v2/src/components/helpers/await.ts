import { isReadable, Signal, subscribe, type Readable } from "../../signal";
import { asParent, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { reconcileChildren } from "..";
import type { Child, IMountable, Mountable } from "../types";

function syncDomOrder(parent: HTMLElement, nodes: Node[], before: Node | null) {
	let cursor: Node | null = before;
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i]!;
		if (node.nextSibling !== cursor) {
			parent.insertBefore(node, cursor);
		}
		cursor = node;
	}
}

function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return new Error(error.message);
	}
	return new Error(String(error));
}

type AwaitState<T> =
	| { status: "pending" }
	| { status: "resolved"; value: T }
	| { status: "rejected"; error: Error };

type AwaitBranch = "pending" | "resolved" | "rejected";

export type AwaitHelper<ThenArg> = Mountable & {
	WhileLoading(...children: Child[]): AwaitHelper<ThenArg>;
	Then(render: (value: ThenArg) => Child): AwaitHelper<ThenArg>;
	Catch(render: (error: Error) => Child): AwaitHelper<ThenArg>;
};

/**
 * Renders from a promise's state: `WhileLoading`, `Then`, `Catch`.
 *
 * A plain promise hands `Then` the resolved value. A `Readable` of a promise
 * hands `Then` a `Readable<T>` — never a writable `Signal` — and re-follows
 * the source: status changes remount the matching branch, a new resolved
 * value patches the readable in place.
 */
export function Await<T>(source: Readable<PromiseLike<T>>): AwaitHelper<Readable<T>>;
export function Await<T>(source: PromiseLike<T>): AwaitHelper<T>;
export function Await<T>(
	source: PromiseLike<T> | Readable<PromiseLike<T>>,
): AwaitHelper<T | Readable<T>> {
	let loading: Child[] = [];
	let thenRender: ((value: T | Readable<T>) => Child) | null = null;
	let catchRender: ((error: Error) => Child) | null = null;

	const helper: AwaitHelper<T | Readable<T>> = Object.assign(
		(): IMountable => {
			const readable = isReadable<PromiseLike<T>>(source);
			let state: AwaitState<T> = { status: "pending" };
			let promise: PromiseLike<T> | null = null;
			let token = 0;
			let valueSignal: Signal<T> | null = null;
			let unsubscribe: Unsubscribe | null = null;
			let parent: HTMLElement | null = null;
			let showing: AwaitBranch | null = null;
			let mounted: IMountable[] = [];
			const endMarker = document.createComment("");

			const thenArg = (): T | Readable<T> => {
				if (readable) {
					if (!valueSignal) throw new Error("Await.Then ran without a resolved value");
					return valueSignal;
				}
				if (state.status !== "resolved") {
					throw new Error("Await.Then ran without a resolved value");
				}
				return state.value;
			};

			const clear = () => {
				for (const child of mounted) child.unmount();
				mounted = [];
			};

			let node: IMountable;

			const sync = () => {
				if (!parent) return;
				if (showing === state.status) return;

				let branch: AwaitBranch = state.status;
				let children: Child[] = [];
				if (branch === "pending") children = loading;
				else if (branch === "resolved") {
					if (thenRender) {
						try {
							children = [thenRender(thenArg())];
						} catch (error) {
							state = { status: "rejected", error: toError(error) };
							branch = "rejected";
						}
					}
				}
				if (branch === "rejected") {
					children = catchRender && state.status === "rejected" ? [catchRender(state.error)] : [];
				}

				clear();
				showing = branch;

				asParent(node, () => {
					for (const child of reconcileChildren({}, ...children)) {
						const instance = child();
						mounted.push(instance);
						mountChild(instance, parent!);
					}
				});
				syncDomOrder(
					parent,
					mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
					endMarker,
				);
			};

			const resolve = (value: T) => {
				if (readable) {
					if (valueSignal) valueSignal.set(value);
					else valueSignal = new Signal(value);
				}

				if (state.status === "resolved") {
					state = { status: "resolved", value };
					return;
				}

				state = { status: "resolved", value };
				sync();
			};

			const reject = (error: Error) => {
				if (state.status === "rejected" && state.error === error) return;
				state = { status: "rejected", error };
				sync();
			};

			const follow = (next: PromiseLike<T>) => {
				if (next === promise) return;
				promise = next;
				const current = ++token;

				if (state.status === "rejected") {
					state = { status: "pending" };
					sync();
				}

				void next.then(
					(value) => {
						if (current !== token) return;
						resolve(value);
					},
					(error) => {
						if (current !== token) return;
						reject(toError(error));
					},
				);
			};

			if (readable) follow(source.get());
			else follow(source);

			node = {
				mount(p: HTMLElement) {
					unsubscribe?.();
					clear();
					showing = null;
					parent = p;
					parent.appendChild(endMarker);
					if (readable) {
						unsubscribe = subscribe([source], (next) => follow(next));
					}
					sync();
				},
				unmount() {
					unsubscribe?.();
					unsubscribe = null;
					clear();
					showing = null;
					endMarker.remove();
					parent = null;
				},
				getFirstDomNode() {
					for (const child of mounted) {
						const first = child.getFirstDomNode();
						if (first) return first;
					}
					return endMarker.isConnected ? endMarker : null;
				},
			};
			return node;
		},
		{
			WhileLoading(...children: Child[]) {
				loading = children;
				return helper;
			},
			Then(render: (value: T | Readable<T>) => Child) {
				thenRender = render;
				return helper;
			},
			Catch(render: (error: Error) => Child) {
				catchRender = render;
				return helper;
			},
		},
	);

	return helper;
}
