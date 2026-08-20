import type { Mountable } from "@implementjs/core";
import AccordionDemo from "./accordion-demo.ts";
import accordionSource from "./accordion-demo.ts?raw";
import AspectRatioDemo from "./aspect-ratio-demo.ts";
import aspectRatioSource from "./aspect-ratio-demo.ts?raw";
import AvatarDemo from "./avatar-demo.ts";
import avatarSource from "./avatar-demo.ts?raw";
import CalendarDemo from "./calendar-demo.ts";
import calendarSource from "./calendar-demo.ts?raw";
import RangeCalendarDemo from "./range-calendar-demo.ts";
import rangeCalendarSource from "./range-calendar-demo.ts?raw";
import CollapsibleDemo from "./collapsible-demo.ts";
import collapsibleSource from "./collapsible-demo.ts?raw";
import CheckboxDemo from "./checkbox-demo.ts";
import checkboxSource from "./checkbox-demo.ts?raw";
import TabsDemo from "./tabs-demo.ts";
import tabsSource from "./tabs-demo.ts?raw";
import SwitchDemo from "./switch-demo.ts";
import switchSource from "./switch-demo.ts?raw";
import LinkPreviewDemo from "./link-preview-demo.ts";
import linkPreviewSource from "./link-preview-demo.ts?raw";
import MeterDemo from "./meter-demo.ts";
import meterSource from "./meter-demo.ts?raw";
import PopoverDemo from "./popover-demo.ts";
import popoverSource from "./popover-demo.ts?raw";
import PopoverNestedDemo from "./popover-nested-demo.ts";
import popoverNestedSource from "./popover-nested-demo.ts?raw";
import PopoverTriggersDemo from "./popover-triggers-demo.ts";
import popoverTriggersSource from "./popover-triggers-demo.ts?raw";
import ProgressDemo from "./progress-demo.ts";
import progressSource from "./progress-demo.ts?raw";
import RadioGroupDemo from "./radio-group-demo.ts";
import radioGroupSource from "./radio-group-demo.ts?raw";
import RatingGroupDemo from "./rating-group-demo.ts";
import ratingGroupSource from "./rating-group-demo.ts?raw";
import SelectDemo from "./select-demo.ts";
import selectSource from "./select-demo.ts?raw";
import SelectMultipleDemo from "./select-multiple-demo.ts";
import selectMultipleSource from "./select-multiple-demo.ts?raw";
import SelectGroupDemo from "./select-group-demo.ts";
import selectGroupSource from "./select-group-demo.ts?raw";
import SeparatorDemo from "./separator-demo.ts";
import separatorSource from "./separator-demo.ts?raw";
import ToggleDemo from "./toggle-demo.ts";
import toggleSource from "./toggle-demo.ts?raw";
import ToggleGroupDemo from "./toggle-group-demo.ts";
import toggleGroupSource from "./toggle-group-demo.ts?raw";
import DialogDemo from "./dialog-demo.ts";
import dialogSource from "./dialog-demo.ts?raw";
import DialogNestedDemo from "./dialog-nested-demo.ts";
import dialogNestedSource from "./dialog-nested-demo.ts?raw";
import TooltipDemo from "./tooltip-demo.ts";
import tooltipSource from "./tooltip-demo.ts?raw";
import AlertDialogDemo from "./alert-dialog-demo.ts";
import alertDialogSource from "./alert-dialog-demo.ts?raw";
import ContextMenuDemo from "./context-menu-demo.ts";
import contextMenuSource from "./context-menu-demo.ts?raw";
import DropdownMenuDemo from "./dropdown-menu-demo.ts";
import dropdownMenuSource from "./dropdown-menu-demo.ts?raw";
import MenubarDemo from "./menubar-demo.ts";
import menubarSource from "./menubar-demo.ts?raw";
import ToastDemo from "./toast-demo.ts";
import toastSource from "./toast-demo.ts?raw";

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
	"aspect-ratio": { source: aspectRatioSource, component: AspectRatioDemo },
	"context-menu": { source: contextMenuSource, component: ContextMenuDemo },
	"dropdown-menu": { source: dropdownMenuSource, component: DropdownMenuDemo },
	menubar: { source: menubarSource, component: MenubarDemo },
	avatar: { source: avatarSource, component: AvatarDemo },
	calendar: { source: calendarSource, component: CalendarDemo },
	"range-calendar": {
		source: rangeCalendarSource,
		component: RangeCalendarDemo,
	},
	collapsible: { source: collapsibleSource, component: CollapsibleDemo },
	checkbox: { source: checkboxSource, component: CheckboxDemo },
	switch: { source: switchSource, component: SwitchDemo },
	tabs: { source: tabsSource, component: TabsDemo },
	"link-preview": { source: linkPreviewSource, component: LinkPreviewDemo },
	meter: { source: meterSource, component: MeterDemo },
	popover: { source: popoverSource, component: PopoverDemo },
	"popover-triggers": {
		source: popoverTriggersSource,
		component: PopoverTriggersDemo,
	},
	"popover-nested": {
		source: popoverNestedSource,
		component: PopoverNestedDemo,
	},
	progress: { source: progressSource, component: ProgressDemo },
	"radio-group": { source: radioGroupSource, component: RadioGroupDemo },
	"rating-group": { source: ratingGroupSource, component: RatingGroupDemo },
	select: { source: selectSource, component: SelectDemo },
	"select-multiple": {
		source: selectMultipleSource,
		component: SelectMultipleDemo,
	},
	"select-group": {
		source: selectGroupSource,
		component: SelectGroupDemo,
	},
	separator: { source: separatorSource, component: SeparatorDemo },
	toggle: { source: toggleSource, component: ToggleDemo },
	"toggle-group": { source: toggleGroupSource, component: ToggleGroupDemo },
	dialog: { source: dialogSource, component: DialogDemo },
	"dialog-nested": { source: dialogNestedSource, component: DialogNestedDemo },
	"alert-dialog": { source: alertDialogSource, component: AlertDialogDemo },
	tooltip: { source: tooltipSource, component: TooltipDemo },
	toast: { source: toastSource, component: ToastDemo },
};
