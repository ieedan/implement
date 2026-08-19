import { dom } from "../../dom";
import { isReadable, subscribe } from "../../signal";
import type { Unsubscribe } from "../../types";
import type { Bindable } from "../props";
import type { Mountable } from "../types";

/**
 * Inserts HTML as sibling nodes. Use this instead of an `innerHTML` prop so
 * surrounding children are not wiped.
 */
export function Html(html: Bindable<string>): Mountable {
	return () => {
		const start = dom.createComment("");
		const end = dom.createComment("");
		let unsubscribe: Unsubscribe | null = null;

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
			clear();
			dom.insertHtml(value, start.parentNode, end);
		};

		return {
			mount(parent: HTMLElement) {
				unsubscribe?.();
				clear();
				start.remove();
				end.remove();
				parent.append(start, end);
				if (typeof html === "string") {
					apply(html);
				} else {
					unsubscribe = subscribe([html], (value) => apply(value ?? ""));
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
