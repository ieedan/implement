import { dom } from "../../dom";
import { claimHtmlBlock } from "../../hydrate";
import { isReadable, subscribe } from "../../signal";
import type { Unsubscribe } from "../../types";
import type { Bindable } from "../props";
import type { Mountable } from "../types";

const toValue = (value: string | null | undefined): string => value ?? "";

/**
 * Inserts HTML as sibling nodes. Use this instead of an `innerHTML` prop so
 * surrounding children are not wiped.
 */
export function Html(html: Bindable<string>): Mountable {
	return () => {
		// tagged data so hydration can find the block's serialized delimiters
		const start = dom.createComment("html");
		const end = dom.createComment("/html");
		let unsubscribe: Unsubscribe | null = null;
		let applied: string | null = null;

		const clear = () => {
			let node = start.nextSibling;
			while (node && node !== end) {
				const next = node.nextSibling;
				node.remove();
				node = next;
			}
		};

		const apply = (value: string) => {
			if (!start.parentNode) return;
			if (value === applied) return;
			applied = value;
			clear();
			dom.insertHtml(value, start.parentNode, end);
		};

		return {
			mount(parent: HTMLElement) {
				unsubscribe?.();
				clear();
				start.remove();
				end.remove();
				applied = null;
				// the markup is trusted and deterministic, so hydration adopts the
				// serialized block as-is instead of re-parsing it
				const block = claimHtmlBlock();
				if (block) {
					parent.insertBefore(start, block.before);
					parent.insertBefore(end, block.after);
					applied = typeof html === "string" ? html : toValue(html.get());
				} else {
					parent.append(start, end);
				}
				if (typeof html === "string") {
					apply(html);
				} else {
					unsubscribe = subscribe([html], (value) => apply(toValue(value)));
				}
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				clear();
				start.remove();
				end.remove();
			},
			getFirstDomNode() {
				const first = start.nextSibling;
				if (first && first !== end) return first;
				return start.isConnected ? start : null;
			},
		};
	};
}
