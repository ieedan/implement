import { Div, type Child, type Mountable } from "@implementjs/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

/** One tab of a markdown tab group: the label from the marker, and the html between markers. */
export type TabPanel = { label: string; children: Child[] };

/**
 * The rendered form of a markdown tab group. Every panel is rendered — the
 * primitive hides the inactive ones rather than unmounting them — so the
 * prerendered page carries all of the content and the copy buttons attach to
 * every code block on mount, not just the open tab's.
 */
export function TabsBlock(panels: TabPanel[]): Mountable {
	return Div(
		{ class: "my-[--typeset-flow] flex flex-col gap-3" },
		Tabs(
			{ value: panels[0]?.label ?? "" },
			// the triggers are chrome, not prose
			TabsList(
				{ variant: "underline", "data-not-typeset": "" },
				...panels.map((panel) =>
					TabsTrigger({ variant: "underline", value: panel.label }, panel.label),
				),
			),
			...panels.map((panel) => TabsContent({ value: panel.label }, ...panel.children)),
		),
	);
}
