import { subscribe } from "../../signal";
import { mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { component } from "..";
import type { Bindable, ElementProps } from "../props";
import type { IMountable, Mountable, PrimitiveChild, ReadableChild } from "../types";

declare const HEAD_CHILD: unique symbol;

/**
 * A component that may only slot into `Implement.Head`. The brand is opaque in
 * both directions: regular children (elements, text, signals) do not satisfy
 * it, and it does not satisfy `Child`, so head elements cannot render into the
 * body and body elements cannot render into the head.
 */
export type HeadChild = { readonly [HEAD_CHILD]: true };

function brand(mountable: Mountable): HeadChild {
	return mountable as unknown as HeadChild;
}

/** `<meta>` attributes. Everything accepts a signal and re-applies on change. */
export type MetaProps = ElementProps<"meta">;

/** `HeadLink` because the router already owns `LinkProps`. */
export type HeadLinkProps = ElementProps<"link">;

/** Content is passed as `Implement.Head.Script`'s second argument, not a prop. */
export type ScriptProps = Omit<ElementProps<"script">, "children">;

/** Content is passed as `Implement.Head.Style`'s first argument, not a prop. */
export type StyleProps = Omit<ElementProps<"style">, "children">;

export type HeadHelper = {
	(...children: HeadChild[]): Mountable;
	/**
	 * Sets `document.title` for as long as it is mounted (tracking a signal),
	 * rather than appending a second `<title>` the browser would ignore. The
	 * title is not restored on unmount — the next mounted `Title` wins.
	 */
	Title(text: Bindable<string>): HeadChild;
	Meta(props: MetaProps): HeadChild;
	Link(props: HeadLinkProps): HeadChild;
	/**
	 * Appends a `<script>`. Inline `content` executes on mount; a readable
	 * `content` updates the text but the browser never re-executes it, so
	 * reactive content is only useful for non-script types like
	 * `application/ld+json`.
	 */
	Script(props: ScriptProps, content?: PrimitiveChild | ReadableChild): HeadChild;
	Style(css: PrimitiveChild | ReadableChild, props?: StyleProps): HeadChild;
};

function Title(text: Bindable<string>): HeadChild {
	return brand(() => {
		let unsubscribe: Unsubscribe | null = null;
		return {
			mount() {
				unsubscribe?.();
				if (typeof text === "string") {
					document.title = text;
				} else {
					unsubscribe = subscribe([text], (value) => {
						document.title = value ?? "";
					});
				}
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
			},
			getFirstDomNode() {
				// no DOM of its own; logical siblings must never anchor against it
				return null;
			},
		};
	});
}

/**
 * Renders its children into `document.head` — the counterpart of Svelte's
 * `<svelte:head>`. Only accepts the branded components under `Implement.Head`
 * (`Title`, `Meta`, `Link`, `Script`, `Style`), and those components fit
 * nowhere else, so head-only elements stay in the head.
 *
 * Elements live in the head for as long as this node is mounted, so lifetime
 * follows tree position: a per-route `Implement.Head` swaps its tags on
 * navigation, and one inside `If(open).Then(...)` adds them while the branch
 * is mounted.
 *
 * ```ts
 * Implement.Head(
 * 	Implement.Head.Title(issue.bind((i) => `${i.name} — Tracker`)),
 * 	Implement.Head.Meta({ name: "description", content: description }),
 * 	Implement.Head.Script(
 * 		{ type: "application/ld+json" },
 * 		description.bind(toJsonLd),
 * 	),
 * );
 * ```
 */
export const Head: HeadHelper = Object.assign(
	(...children: HeadChild[]): Mountable => {
		const mountables = children as unknown as Mountable[];
		return () => {
			let mounted: IMountable[] = [];
			return {
				mount() {
					mounted = [];
					for (const child of mountables) {
						const instance = child();
						mounted.push(instance);
						mountChild(instance, document.head);
					}
				},
				unmount() {
					for (const child of mounted) child.unmount();
					mounted = [];
				},
				getFirstDomNode() {
					// renders into document.head; logical siblings must never anchor against it
					return null;
				},
			};
		};
	},
	{
		Title,
		Meta(props: MetaProps): HeadChild {
			return brand(component("meta", props));
		},
		Link(props: HeadLinkProps): HeadChild {
			return brand(component("link", props));
		},
		Script(props: ScriptProps, content?: PrimitiveChild | ReadableChild): HeadChild {
			return brand(
				content === undefined ? component("script", props) : component("script", props, content),
			);
		},
		Style(css: PrimitiveChild | ReadableChild, props: StyleProps = {}): HeadChild {
			return brand(component("style", props, css));
		},
	},
);
