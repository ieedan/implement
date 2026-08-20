import type { IMountable } from "./components/types";
import { currentNode, parentOf, raiseError } from "./tree";
import type { Unsubscribe } from "./types";

/**
 * Runs while its subtree is leaving, before anything is removed from the DOM.
 * Removal waits for the returned promise. `signal` aborts when the exit is
 * cancelled — the subtree came back (a `ForEach` key re-added, a branch
 * re-shown) or the whole tree is being torn down — at which point the hook
 * should stop whatever it started.
 */
export type ExitHook = (signal: AbortSignal) => PromiseLike<void> | void;

type ExitRecord = {
	hook: ExitHook;
	controller: AbortController | null;
};

/**
 * `node` → every exit hook registered at or below it. Written by walking up
 * from the registering node, so a removal at any depth can ask "does this
 * subtree animate out?" in constant time, and nothing is paid by trees that
 * never register a hook.
 */
const subtreeHooks = new WeakMap<IMountable, Set<ExitRecord>>();

/** Nodes whose removal is deferred until their hooks settle. */
const exiting = new WeakSet<IMountable>();

/**
 * How many times a node has started exiting. A cancelled exit can leave its
 * promise pending — aborting a hook does not oblige it to settle — so a run
 * that resolves after the node left, came back and left again must not finish
 * the newer exit on the older run's behalf.
 */
const generations = new WeakMap<IMountable, number>();

function chainFrom(node: IMountable): IMountable[] {
	const chain: IMountable[] = [];
	for (let current: IMountable | null = node; current; current = parentOf(current)) {
		chain.push(current);
	}
	return chain;
}

/**
 * Registers `hook` for the node being mounted, deferring removal of it — and
 * of every ancestor removed while it is mounted — until the hook settles.
 * Must be called during a mount pass; outside one (a server render, a
 * detached instance) it is a no-op, which is what makes `Lifecycle.onExit`
 * inert on the server.
 */
export function registerExit(hook: ExitHook): Unsubscribe {
	const owner = currentNode();
	if (!owner) return () => {};

	const record: ExitRecord = { hook, controller: null };
	const chain = chainFrom(owner);
	for (const node of chain) {
		let records = subtreeHooks.get(node);
		if (!records) {
			records = new Set();
			subtreeHooks.set(node, records);
		}
		records.add(record);
	}

	return () => {
		record.controller?.abort();
		record.controller = null;
		for (const node of chain) subtreeHooks.get(node)?.delete(record);
	};
}

/** Aborts every hook under `instance` and clears its exiting mark. */
function abortExit(instance: IMountable): void {
	for (const record of subtreeHooks.get(instance) ?? []) {
		record.controller?.abort();
		record.controller = null;
	}
	exiting.delete(instance);
}

/**
 * Removes `instance` from the tree, waiting for any exit hooks beneath it.
 *
 * With no hooks registered this is `instance.unmount()` — the same
 * synchronous removal every helper did before exits existed, with no promise
 * and no extra task. With hooks it returns `true` and the caller must keep
 * `instance` in its DOM ordering until `onDone` runs: the subtree is still
 * mounted (subscriptions live, nodes on screen) while the hooks run.
 */
export function removeChild(instance: IMountable, onDone?: () => void): boolean {
	const records = subtreeHooks.get(instance);
	if (!records || records.size === 0) {
		instance.unmount();
		onDone?.();
		return false;
	}

	exiting.add(instance);
	const generation = (generations.get(instance) ?? 0) + 1;
	generations.set(instance, generation);
	const pending: PromiseLike<unknown>[] = [];
	for (const record of records) {
		const controller = new AbortController();
		record.controller = controller;
		try {
			const result = record.hook(controller.signal);
			if (result) pending.push(Promise.resolve(result));
		} catch (error) {
			if (!raiseError(instance, error)) throw error;
		}
	}

	const finish = () => {
		// cancelled: revived by the caller, or torn down forcibly
		if (!exiting.has(instance)) return;
		// superseded: this run's node already left again on a later run
		if (generations.get(instance) !== generation) return;
		exiting.delete(instance);
		for (const record of records) record.controller = null;
		instance.unmount();
		onDone?.();
	};

	if (pending.length === 0) {
		queueMicrotask(finish);
	} else {
		void Promise.allSettled(pending).then(finish);
	}
	return true;
}

/**
 * Cancels an in-flight exit and keeps `instance` mounted — the subtree was
 * never torn down, so it comes back live. Returns false when it was not
 * exiting.
 */
export function cancelExit(instance: IMountable): boolean {
	if (!exiting.has(instance)) return false;
	abortExit(instance);
	return true;
}

/**
 * Unmounts now, aborting any exit in flight. Teardown paths (a helper's own
 * `unmount`, `App.unmount`, a hydration mismatch) use this: nothing is left
 * animating over a tree that is going away.
 */
export function forceUnmount(instance: IMountable): void {
	abortExit(instance);
	instance.unmount();
}

/**
 * Removes each of `children`, tracking any that defer in `exitingOut` so the
 * caller keeps them in its DOM ordering until they finish. The shared shape
 * behind `If`/`Switch`/`Key`/`Await`/`Portal` swapping their children out.
 */
export function removeChildren(children: readonly IMountable[], exitingOut: IMountable[]): void {
	for (const child of children) {
		const deferred = removeChild(child, () => {
			const index = exitingOut.indexOf(child);
			if (index !== -1) exitingOut.splice(index, 1);
		});
		if (deferred) exitingOut.push(child);
	}
}

/**
 * Force-unmounts a helper's live and exiting children and empties both lists.
 * The teardown counterpart of `removeChildren`: a helper going away takes
 * everything under it, exits in flight included.
 */
export function teardownChildren(children: IMountable[], exitingList: IMountable[]): void {
	teardownAll(exitingList);
	teardownAll(children);
}

/** Force-unmounts `children` and empties the list. */
export function teardownAll(children: IMountable[]): void {
	for (const child of children.splice(0)) forceUnmount(child);
}

/** First DOM node of the exiting children, which sit before the live ones. */
export function firstExitingNode(exitingList: readonly IMountable[]): Node | null {
	for (const child of exitingList) {
		const first = child.getFirstDomNode();
		if (first) return first;
	}
	return null;
}

/** DOM nodes of the exiting children, in the order they should stay in. */
export function exitingNodes(exitingList: readonly IMountable[]): Node[] {
	const nodes: Node[] = [];
	for (const child of exitingList) {
		const first = child.getFirstDomNode();
		if (first) nodes.push(first);
	}
	return nodes;
}
