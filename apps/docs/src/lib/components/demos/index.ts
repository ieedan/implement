import type { Mountable } from "@implementjs/core";
import AccordionDemo from "./accordion-demo.ts";
import accordionSource from "./accordion-demo.ts?raw";
import AvatarDemo from "./avatar-demo.ts";
import avatarSource from "./avatar-demo.ts?raw";
import CollapsibleDemo from "./collapsible-demo.ts";
import collapsibleSource from "./collapsible-demo.ts?raw";
import CheckboxDemo from "./checkbox-demo.ts";
import checkboxSource from "./checkbox-demo.ts?raw";
import PopoverDemo from "./popover-demo.ts";
import popoverSource from "./popover-demo.ts?raw";
import PopoverNestedDemo from "./popover-nested-demo.ts";
import popoverNestedSource from "./popover-nested-demo.ts?raw";
import PopoverTriggersDemo from "./popover-triggers-demo.ts";
import popoverTriggersSource from "./popover-triggers-demo.ts?raw";
import SelectDemo from "./select-demo.ts";
import selectSource from "./select-demo.ts?raw";
import SelectMultipleDemo from "./select-multiple-demo.ts";
import selectMultipleSource from "./select-multiple-demo.ts?raw";
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
	collapsible: { source: collapsibleSource, component: CollapsibleDemo },
	checkbox: { source: checkboxSource, component: CheckboxDemo },
	popover: { source: popoverSource, component: PopoverDemo },
	"popover-triggers": { source: popoverTriggersSource, component: PopoverTriggersDemo },
	"popover-nested": { source: popoverNestedSource, component: PopoverNestedDemo },
	select: { source: selectSource, component: SelectDemo },
	"select-multiple": { source: selectMultipleSource, component: SelectMultipleDemo },
	separator: { source: separatorSource, component: SeparatorDemo },
};
