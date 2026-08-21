import { dom } from "../../dom";
import { subscribe } from "../../signal";
import type { Unsubscribe } from "../../types";
import { applySvgProps, type Bindable, type SvgProps } from "../props";
import type { Mountable } from "../types";

export type { SvgProps } from "../props";

/**
 * Builds an `<svg>` element from trusted markup. The string is the template
 * (parsed once and cloned per mount), the props are the instance: they are
 * applied to the root after cloning, so they override attributes baked into
 * the source. A reactive source swaps the whole element in place; reactive
 * props update attributes without any re-parsing.
 *
 * ```ts
 * Svg(icons.check, { class: "h-4 w-4", fill: color, onClick });
 * ```
 */
export function Svg(source: Bindable<string>, props: SvgProps = {}): Mountable {
	return () => {
		/**
		 * The one node this mountable stands on: the `<svg>` once there is one,
		 * a placeholder comment while there is not. Standing on exactly one
		 * node is what keeps the position and the content together — a parent's
		 * `syncDomOrder` moves whatever `getFirstDomNode` reports, so a separate
		 * anchor would be left behind by that move, sending the next swap
		 * somewhere else and leaving the server's markup in an order hydration
		 * could not replay.
		 */
		let current: ChildNode | null = null;
		let element: SVGSVGElement | null = null;
		let unsubscribeProps: Unsubscribe | null = null;
		let unsubscribeSource: Unsubscribe | null = null;

		/** Let go of the current element (its props binding and `this`). */
		const release = () => {
			if (element) props.this?.set(null);
			unsubscribeProps?.();
			unsubscribeProps = null;
			element = null;
		};

		/** Put `next` where this mountable stands, dropping what stood there. */
		const stand = (next: ChildNode) => {
			const previous = current;
			if (previous === next) return;
			previous?.after(next);
			previous?.remove();
			current = next;
		};

		const apply = (value: string) => {
			if (!current?.parentNode) return;
			// during hydration this claims the serialized <svg> standing here
			const next = dom.createSvgRoot(value);
			release();
			if (!next) {
				stand(dom.createComment("svg"));
				return;
			}
			unsubscribeProps = applySvgProps(next, props);
			element = next;
			stand(next);
			props.this?.set(next);
		};

		return {
			mount(parent: HTMLElement) {
				unsubscribeSource?.();
				unsubscribeSource = null;
				release();
				current?.remove();
				current = dom.createComment("svg");
				dom.attach(parent, current);
				if (typeof source === "string") {
					apply(source);
				} else {
					unsubscribeSource = subscribe([source], (value) => apply(value ?? ""));
				}
			},
			unmount() {
				unsubscribeSource?.();
				unsubscribeSource = null;
				release();
				current?.remove();
				current = null;
			},
			getFirstDomNode() {
				// parentNode, not isConnected: a tree mounted into a detached
				// container is still in position, it just is not in the document
				return current?.parentNode ? current : null;
			},
		};
	};
}
