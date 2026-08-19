import type { Mountable } from "@implementjs/core";
import AccordionDemo from "./accordion-demo.ts";
import accordionSource from "./accordion-demo.ts?raw";
import AvatarDemo from "./avatar-demo.ts";
import avatarSource from "./avatar-demo.ts?raw";
import SeparatorDemo from "./separator-demo.ts";
import separatorSource from "./separator-demo.ts?raw";

export type Demo = {
	/** The demo's source text: shown in the editor and, once edited, compiled and run live. */
	source: string;
	/**
	 * The same module imported statically. The pristine demo renders through
	 * this instead of the compile pipeline, so it is synchronous — part of the
	 * server render and the client's first paint.
	 */
	component: () => Mountable;
};

/**
 * Demos, keyed by the `data-demo` attribute a docs page uses to place them:
 * `<div data-demo="avatar"></div>` in the markdown renders an editable demo
 * of `demos.avatar` at that spot.
 *
 * Each demo is one real module (type-checked like any other) imported both
 * ways: statically for the initial render, and as raw text so the reader can
 * edit and re-run it live in the browser.
 */
export const demos: Record<string, Demo> = {
	accordion: { source: accordionSource, component: AccordionDemo },
	avatar: { source: avatarSource, component: AvatarDemo },
	separator: { source: separatorSource, component: SeparatorDemo },
};
