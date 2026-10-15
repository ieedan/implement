import {
	Div,
	Span,
	type Bindable,
	type Child,
	type ComponentProps,
	type ElementProps,
} from "@implementjs/core";
import { ChevronRightIcon } from "@implementjs/lucide";
import {
	Collapsible as CollapsiblePrimitive,
	CollapsibleContent as CollapsibleContentPrimitive,
	CollapsibleTrigger as CollapsibleTriggerPrimitive,
	createComponent,
} from "@implementjs/primitives";
import { cn } from "@/lib/utils";

/**
 * Where a step stands. Leave it unset for work that is done: the line reads
 * as plain text.
 */
export type TraceStatus = "running" | "error" | "pending";

export type TraceProps = ElementProps<"div">;
export type TraceLineProps = ElementProps<"span"> & {
	/**
	 * `running` shimmers the title, `error` turns the line destructive, and
	 * `pending` dims it. Pass a readable to move a step along as it runs.
	 */
	status?: Bindable<TraceStatus | undefined>;
};
export type TraceIconProps = ElementProps<"span">;
export type TraceTitleProps = ElementProps<"span">;
export type TraceDescriptionProps = ElementProps<"span">;
export type TraceCollapsibleProps = ComponentProps<typeof CollapsiblePrimitive>;
export type TraceCollapsibleTriggerProps = ComponentProps<typeof CollapsibleTriggerPrimitive>;
export type TraceCollapsibleContentProps = ComponentProps<typeof CollapsibleContentPrimitive>;

/**
 * A list of steps: reasoning, tool calls, sources, the plan an agent is
 * working through. Each step is a `TraceLine`, on its own or wrapped in
 * whatever makes it do something — a `TraceCollapsible` to expand it, an `A`
 * to link out, a dialog or popover trigger to open one.
 */
export const Trace = createComponent(function Trace(
	{ class: className, ...props }: TraceProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "trace",
			class: cn(
				"flex w-full min-w-0 flex-col gap-2",
				// a line wrapped in a link or a trigger: the wrapper takes the
				// line's footprint, and the focus ring, so the line stays text
				"*:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:rounded-md *:has-[>[data-slot=trace-line]]:text-left *:has-[>[data-slot=trace-line]]:outline-none *:has-[>[data-slot=trace-line]]:focus-visible:ring-[3px] *:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/50",
				className,
			),
		},
		...children,
	);
});

/** One step: an icon, a title, and optionally a description beside it. */
export const TraceLine = createComponent(function TraceLine(
	{ class: className, status, ...props }: TraceLineProps,
	...children: Child[]
) {
	return Span(
		{
			...props,
			"data-slot": "trace-line",
			"data-status": status,
			class: cn(
				"flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors",
				"in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-foreground",
				"data-[status=error]:text-destructive data-[status=error]:in-[a:hover,button:hover]:text-destructive",
				"data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:shimmer",
				className,
			),
		},
		...children,
	);
});

/** A 16px slot for an icon, before the title or after it. Hidden from screen readers. */
export const TraceIcon = createComponent(function TraceIcon(
	{ class: className, ...props }: TraceIconProps,
	...children: Child[]
) {
	return Span(
		{
			"aria-hidden": "true",
			...props,
			"data-slot": "trace-icon",
			class: cn(
				"flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				// an icon after the title sits a little closer to it
				"[[data-slot=trace-title]~&]:-ml-1",
				className,
			),
		},
		...children,
	);
});

/**
 * What the step did, in one line. It truncates rather than wrapping, and
 * shimmers while its line is `running`.
 */
export const TraceTitle = createComponent(function TraceTitle(
	{ class: className, ...props }: TraceTitleProps,
	...children: Child[]
) {
	return Span(
		{
			...props,
			"data-slot": "trace-title",
			class: cn("min-w-0 truncate motion-reduce:shimmer-none", className),
		},
		...children,
	);
});

/** A short aside after the title: a duration, a count, a file size. */
export const TraceDescription = createComponent(function TraceDescription(
	{ class: className, ...props }: TraceDescriptionProps,
	...children: Child[]
) {
	return Span(
		{
			...props,
			"data-slot": "trace-description",
			class: cn("shrink-0 text-muted-foreground/70 tabular-nums", className),
		},
		...children,
	);
});

/** A step that expands to show more: its output, its reasoning, the steps under it. */
export const TraceCollapsible = createComponent(function TraceCollapsible(
	{ class: className, ...props }: TraceCollapsibleProps,
	...children: Child[]
) {
	return CollapsiblePrimitive(
		{
			...props,
			"data-slot": "trace-collapsible",
			class: cn("flex w-full min-w-0 flex-col", className),
		},
		...children,
	);
});

/** Wraps the step's `TraceLine` and puts a chevron after it that turns as it opens. */
export const TraceCollapsibleTrigger = createComponent(function TraceCollapsibleTrigger(
	{ class: className, type = "button", ...props }: TraceCollapsibleTriggerProps,
	...children: Child[]
) {
	return CollapsibleTriggerPrimitive(
		{
			type,
			...props,
			"data-slot": "trace-collapsible-trigger",
			class: cn(
				"group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 has-[[data-status=error]]:text-destructive",
				className,
			),
		},
		...children,
		TraceIcon(
			{
				class: "transition-transform group-aria-expanded/trace-collapsible-trigger:rotate-90",
			},
			ChevronRightIcon(),
		),
	);
});

/**
 * The detail under a step, indented behind a rule. `class` lands on an inner
 * `Div`, so padding you add does not fight the height animation.
 */
export const TraceCollapsibleContent = createComponent(function TraceCollapsibleContent(
	{ class: className, ...props }: TraceCollapsibleContentProps,
	...children: Child[]
) {
	return CollapsibleContentPrimitive(
		{
			...props,
			"data-slot": "trace-collapsible-content",
			class:
				"min-w-0 overflow-hidden motion-reduce:animate-none data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
		},
		Div(
			{
				"data-slot": "trace-collapsible-content-inner",
				class: cn(
					"mt-2 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 border-l pr-1 pl-4 leading-relaxed wrap-break-word text-muted-foreground",
					className,
				),
			},
			...children,
		),
	);
});
