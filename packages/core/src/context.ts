import { reconcileChildren } from "./components";
import type { Child, IMountable, Mountable } from "./components/types";
import { mountChild, parentOf } from "./tree";
import { captureStack, frameLocation } from "./utils";

class ContextProvideBuilder<T> {
	constructor(
		private readonly context: context<T>,
		private readonly value: T,
	) {}

	To(...children: Child[]): Mountable {
		const context = this.context;
		const value = this.value;
		return () => {
			const childrenArray = reconcileChildren({}, ...children);
			const mountedChildren: IMountable[] = [];
			const node: IMountable = {
				mount(parent: HTMLElement) {
					mountedChildren.length = 0;
					context.provide(node, value);
					for (const child of childrenArray) {
						const instance = child();
						mountedChildren.push(instance);
						mountChild(instance, parent);
					}
				},
				unmount() {
					for (const child of mountedChildren) child.unmount();
					mountedChildren.length = 0;
				},
				getFirstDomNode() {
					for (const child of mountedChildren) {
						const first = child.getFirstDomNode();
						if (first) return first;
					}
					return null;
				},
			};
			return node;
		};
	}
}

/**
 * A missing provider is a mistake in the caller's tree, but nothing about the
 * throw site says so: `Use()` builds a mountable that core mounts later, so the
 * stack at the throw is core's own mount plumbing, identical for every context
 * in the app. What is worth reporting is captured where it is still known — the
 * context's identity when it was created, and the frames of the `Use()` call
 * when the mountable was built — and stands in as the thrown error's stack.
 */
function missingProviderError(name: Identity, site: CallSite, parent: HTMLElement): Error {
	// The terse form still names the context, which is the one thing a production
	// stack cannot recover. Everything that makes the long form worth reading —
	// the call site, the DOM path, the remedy — is what pulls the reporting
	// helpers into the bundle, so it is development-only.
	if (!import.meta.env?.DEV) {
		return new Error(`[implement] ${name.subject}.Use() found no matching Provide() above it.`);
	}
	const where = domPath(parent);
	const message = [
		`[implement] ${name.subject}.Use() found no matching Provide() above it.`,
		`  context:  ${name.detail}`,
		`  used at:  ${site.location ?? "(unknown — no stack available)"}`,
		where ? `  inside:   ${where}` : "",
		`Wrap an ancestor in ${name.subject}.Provide(value).To(...), or read it with`,
		`${name.subject}.UseOr(render, fallback) to render without a provider.`,
	]
		.filter(Boolean)
		.join("\n");
	const error = new Error(message);
	if (site.stack) {
		// the mount frames stay on as the tail — a signal-driven remount reaches
		// this through user code too — with the frames worth reading first
		error.stack = [
			`Error: ${message}`,
			site.stack,
			"  --- mounted from ---",
			captureStack(["context"]),
		]
			.filter(Boolean)
			.join("\n");
	}
	return error;
}

/**
 * `body > div#app > section.cards`: the element the mount was filling and what
 * it sits under, as far up as the DOM knows it. Every read here is one the
 * server's structural stand-in answers too, and a parent is only linked once
 * its own mount finishes, so this often stops at the immediate parent.
 */
function domPath(element: HTMLElement | null): string | undefined {
	const steps: string[] = [];
	let current: HTMLElement | null = element;
	while (current && steps.length < 4) {
		const id = current.getAttribute("id");
		const className = current.getAttribute("class")?.trim().split(/\s+/)[0];
		let step = current.localName;
		if (id) step += `#${id}`;
		else if (className) step += `.${className}`;
		steps.unshift(step);
		current = current.parentElement ?? null;
	}
	if (steps.length === 0) return undefined;
	return current ? `… > ${steps.join(" > ")}` : steps.join(" > ");
}

/** Where a `Use()` call came from, captured when it builds its mountable. */
type CallSite = { stack: string | undefined; location: string | undefined };

/** How a context reads in an error: what to call it, and how to tell it apart. */
type Identity = { subject: string; detail: string };

function identify(name: string | undefined, createdAt: string | undefined): Identity {
	// `detail` is only ever read by the long-form error, so production keeps the
	// subject (which the terse one names) and skips composing the rest.
	if (!import.meta.env?.DEV) return { subject: name ?? "context", detail: "" };
	const at = createdAt ? `created at ${createdAt}` : "creation site unknown";
	if (name) return { subject: name, detail: `${name}, ${at}` };
	return { subject: "context", detail: `unnamed, ${at}` };
}

function contextUse<T, Fallback = T>(
	context: context<T>,
	name: Identity,
	render: (value: T | Fallback) => Child,
	fallback?: { value: Fallback },
): Mountable {
	const stack = captureStack(["context"]);
	const site: CallSite = { stack, location: frameLocation(stack) };
	return () => {
		let mounted: IMountable[] = [];
		const node: IMountable = {
			mount(parent: HTMLElement) {
				for (const child of mounted) child.unmount();
				mounted = [];

				const result = context.lookup(node);
				let value: T | Fallback;
				if (result.found) {
					value = result.value;
				} else if (fallback) {
					value = fallback.value;
				} else {
					throw missingProviderError(name, site, parent);
				}

				for (const child of reconcileChildren({}, render(value))) {
					const instance = child();
					mounted.push(instance);
					mountChild(instance, parent);
				}
			},
			unmount() {
				for (const child of mounted) child.unmount();
				mounted = [];
			},
			getFirstDomNode() {
				for (const child of mounted) {
					const first = child.getFirstDomNode();
					if (first) return first;
				}
				return null;
			},
		};
		return node;
	};
}

class ContextStore<T> {
	readonly #values = new WeakMap<IMountable, T>();
	readonly #identity: Identity;

	constructor(identity: Identity) {
		this.#identity = identity;
	}

	provide(node: IMountable, value: T): void {
		this.#values.set(node, value);
	}

	lookup(from: IMountable): { found: true; value: T } | { found: false } {
		let node = parentOf(from);
		while (node) {
			if (this.#values.has(node)) return { found: true, value: this.#values.get(node)! };
			node = parentOf(node);
		}
		return { found: false };
	}

	Provide(value: T): ContextProvideBuilder<T> {
		return new ContextProvideBuilder(this, value);
	}

	Use(render: (value: T) => Child): Mountable {
		return contextUse(this, this.#identity, render);
	}

	UseOr<Fallback>(render: (value: T | Fallback) => Child, fallback: Fallback): Mountable {
		return contextUse(this, this.#identity, render, { value: fallback });
	}
}

export type context<T> = ContextStore<T>;

/**
 * Create a context for passing a value down the tree without props.
 *
 * `Provide(value).To(...children)` wraps a subtree. `Use(render)` reads the
 * nearest provided value and throws if missing. `UseOr(render, fallback)`
 * supplies a default; `render` receives `T | typeof fallback`.
 *
 * `name` is what a missing-provider error calls this context. It is worth
 * passing: without one the error falls back to the file and line `context()`
 * was called on.
 */
export function context<T>(name?: string): context<T> {
	return new ContextStore(identify(name, frameLocation(captureStack(["context"]))));
}
