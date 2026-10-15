import {
	Code,
	derived,
	Div,
	ForEach,
	If,
	ImplementLifecycle,
	isReadable,
	Pre,
	signal,
	Span,
	type Child,
	type ElementProps,
	type PrimitiveChild,
	type Readable,
} from "@implementjs/core";
import { CheckIcon, CopyIcon } from "@implementjs/lucide";
import { createComponent, mergeProps } from "@implementjs/primitives";
import { tv, type VariantProps } from "tailwind-variants";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";

export const codeBlockVariants = tv({
	base: "group/code-block relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg text-sm has-[>[data-slot=code-block-content]:focus-visible]:ring-[3px] has-[>[data-slot=code-block-content]:focus-visible]:ring-ring/50 data-[size=sm]:text-xs",
	variants: {
		variant: {
			default:
				"border border-input text-foreground has-[>[data-slot=code-block-content]:focus-visible]:border-ring dark:bg-input/30",
			destructive: "border border-destructive/30 text-destructive dark:border-destructive/40",
		},
	},
	defaultVariants: { variant: "default" },
});

export const codeBlockLineVariants = tv({
	base: [
		"relative -mx-4 block min-h-lh px-4 group-data-[size=sm]/code-block:-mx-3 group-data-[size=sm]/code-block:px-3",
		// the line number, and the + or − a diff line puts in the gutter
		"before:min-w-6 before:text-end before:text-muted-foreground after:absolute after:start-1 after:top-0 after:text-muted-foreground after:select-none",
		"in-data-numbered:col-span-2 in-data-numbered:grid in-data-numbered:grid-cols-subgrid in-data-numbered:gap-x-3 in-data-numbered:[counter-increment:line] in-data-numbered:before:content-[counter(line)] in-data-numbered:before:select-none in-data-numbered:supports-[content:counter(line)_/_'']:before:content-[counter(line)_/_'']",
	],
	variants: {
		variant: {
			default: "",
			added: "bg-muted after:content-['+']",
			removed: "bg-destructive/10 after:text-destructive after:content-['−']",
			highlighted: "bg-muted",
		},
	},
	defaultVariants: { variant: "default" },
});

export type CodeBlockVariant = VariantProps<typeof codeBlockVariants>["variant"];
export type CodeBlockLineVariant = VariantProps<typeof codeBlockLineVariants>["variant"];

export type CodeBlockProps = ElementProps<"div"> &
	VariantProps<typeof codeBlockVariants> & {
		/** `sm` tightens the padding and type, for tool output inside a `Trace`. */
		size?: "default" | "sm";
	};
export type CodeBlockHeaderProps = ElementProps<"div">;
export type CodeBlockTitleProps = ElementProps<"div">;
export type CodeBlockActionsProps = ElementProps<"div">;
export type CodeBlockCopyButtonProps = Omit<ButtonProps, "value"> & {
	/** The text written to the clipboard. Pass a readable when the code streams in. */
	value: string | Readable<string>;
};
export type CodeBlockContentProps = ElementProps<"pre"> & {
	/** Wrap long lines instead of scrolling sideways. */
	wrap?: boolean;
	/**
	 * Number the lines. Code passed as text is split into `CodeBlockLine`s for
	 * you; pass lines of your own to mark some of them as a diff.
	 */
	lineNumbers?: boolean;
	/** The number the first line gets. */
	startLine?: number;
};
export type CodeBlockLineProps = ElementProps<"span"> & VariantProps<typeof codeBlockLineVariants>;
export type CodeBlockFooterProps = ElementProps<"div">;

/**
 * Code, terminal output, logs, or a diff, in a bordered panel. Put a
 * `CodeBlockContent` in it, and a header, footer, or actions around that.
 */
export const CodeBlock = createComponent(function CodeBlock(
	{ class: className, variant = "default", size = "default", ...props }: CodeBlockProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "code-block",
			"data-variant": variant,
			"data-size": size,
			class: cn(codeBlockVariants({ variant }), className),
		},
		...children,
	);
});

/** A row above the code for a title, and actions pushed to the end of it. */
export const CodeBlockHeader = createComponent(function CodeBlockHeader(
	{ class: className, ...props }: CodeBlockHeaderProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "code-block-header",
			class: cn(
				"flex min-w-0 shrink-0 items-center gap-2 px-4 pt-4 text-muted-foreground group-data-[size=sm]/code-block:px-3 group-data-[size=sm]/code-block:pt-3 group-data-[variant=destructive]/code-block:text-destructive *:has-[>[data-slot=code-block-title]]:min-w-0",
				className,
			),
		},
		...children,
	);
});

/** The file name or command the code belongs to. An icon in front of it is sized for you. */
export const CodeBlockTitle = createComponent(function CodeBlockTitle(
	{ class: className, ...props }: CodeBlockTitleProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "code-block-title",
			class: cn(
				"min-w-0 truncate font-sans text-sm font-medium text-foreground group-data-[size=sm]/code-block:text-xs group-data-[variant=destructive]/code-block:text-destructive",
				"[&_svg]:pointer-events-none [&_svg]:inline-block [&_svg]:align-middle [&_svg:not([class*='size-'])]:size-4 group-data-[size=sm]/code-block:[&_svg:not([class*='size-'])]:size-3.5 *:[svg]:me-1.5",
				className,
			),
		},
		...children,
	);
});

/**
 * Buttons for the code: copy, expand, download. In a header they sit at its
 * end; placed straight in the `CodeBlock` they float over the top corner and
 * show on hover or focus (always, on a touch screen).
 */
export const CodeBlockActions = createComponent(function CodeBlockActions(
	{ class: className, ...props }: CodeBlockActionsProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "code-block-actions",
			class: cn(
				"-my-1 ms-auto -me-1.5 flex shrink-0 items-center gap-1",
				"[[data-slot=code-block]>&]:absolute [[data-slot=code-block]>&]:end-3 [[data-slot=code-block]>&]:top-3 [[data-slot=code-block]>&]:z-10 [[data-slot=code-block]>&]:m-0",
				"[[data-slot=code-block]>&]:opacity-0 [[data-slot=code-block]>&]:transition-opacity [[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 [[data-slot=code-block]>&]:group-hover/code-block:opacity-100 [[data-slot=code-block]>&]:pointer-coarse:opacity-100",
				"group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:end-2 group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:top-2",
				"[[data-slot=code-block]>&]:*:[button]:bg-background [[data-slot=code-block]>&]:*:[button]:ring-1 [[data-slot=code-block]>&]:*:[button]:ring-foreground/10",
				className,
			),
		},
		...children,
	);
});

/** How long the check stays up after a copy, in milliseconds. */
const COPIED_FOR = 2000;

/**
 * Copies `value` to the clipboard, then shows a check for two seconds. The
 * change is announced to screen readers as well as drawn.
 */
export const CodeBlockCopyButton = createComponent(function CodeBlockCopyButton({
	value,
	variant = "ghost",
	size = "icon-xs",
	onClick,
	...props
}: CodeBlockCopyButtonProps) {
	const copied = signal(false);
	let timeout: ReturnType<typeof setTimeout> | undefined;

	return ImplementLifecycle(
		{ onUnmount: () => clearTimeout(timeout) },
		Button(
			{
				...props,
				variant,
				size,
				"data-copied": copied.bind((value) => value || undefined),
				"aria-label": copied.bind((value) => (value ? "Copied" : "Copy")),
				onClick(event) {
					const click = isReadable<typeof onClick>(onClick) ? onClick.get() : onClick;
					if (typeof click === "function") click.call(this, event);

					const text = isReadable(value) ? value.get() : value;
					navigator.clipboard
						.writeText(text)
						.then(() => {
							copied.set(true);
							clearTimeout(timeout);
							timeout = setTimeout(() => copied.set(false), COPIED_FOR);
						})
						.catch(() => {});
				},
			},
			If(copied, CheckIcon()).Else(CopyIcon()),
		),
		Span(
			{ "aria-live": "polite", class: "sr-only" },
			copied.bind((value) => (value ? "Copied" : "")),
		),
	);
});

/** Splits code into lines, dropping the one empty line a trailing newline would add. */
function splitLines(code: string): string[] {
	return code.replace(/\n$/, "").split("\n");
}

/** The children as one string, when every one of them is plain text — `null` when any is not. */
function plainText(children: Child[]): string | null {
	let text = "";
	for (const child of children) {
		if (typeof child === "string" || typeof child === "number") text += child;
		else if (child !== null && child !== undefined && child !== false) return null;
	}
	return text;
}

/**
 * The code itself, in a `Pre` that scrolls sideways (or wraps, with `wrap`)
 * and fades its edges as it does. It is focusable, so the keyboard can scroll
 * it too.
 *
 * With `lineNumbers`, code passed as text — a string, or a readable one that
 * grows as it streams — is split into numbered lines.
 */
export const CodeBlockContent = createComponent(function CodeBlockContent(
	{
		class: className,
		style,
		wrap = false,
		lineNumbers = false,
		startLine = 1,
		...props
	}: CodeBlockContentProps,
	...children: Child[]
) {
	let lines: Child[] = children;
	if (lineNumbers) {
		const text = plainText(children);
		const [only] = children;
		if (text !== null) {
			lines = splitLines(text).map((line) => CodeBlockLine(line));
		} else if (children.length === 1 && isReadable<PrimitiveChild>(only)) {
			const split = derived([only], (code) => splitLines(String(code ?? "")));
			lines = [
				ForEach(
					split,
					(_, index) => index,
					(line) => CodeBlockLine(line),
				),
			];
		}
	}

	return Pre(
		mergeProps(
			{
				...props,
				"data-slot": "code-block-content",
				"data-wrap": wrap || undefined,
				"data-numbered": lineNumbers || undefined,
				dir: "ltr" as const,
				tabIndex: 0,
				style: { counterReset: `line ${startLine - 1}` },
				class: cn(
					"min-h-0 min-w-0 scroll-fade-x scrollbar-thin overflow-auto px-4 py-4 text-start font-mono leading-relaxed outline-none",
					"group-has-data-[slot=code-block-footer]/code-block:pb-2 group-has-data-[slot=code-block-header]/code-block:pt-2",
					"group-data-[size=sm]/code-block:px-3 group-data-[size=sm]/code-block:py-3 group-data-[size=sm]/code-block:group-has-data-[slot=code-block-header]/code-block:pt-1.5",
					"data-wrap:scroll-fade-y data-wrap:wrap-break-word data-wrap:whitespace-pre-wrap",
					className,
				),
			},
			{ style },
		),
		Code(
			{
				"data-slot": "code-block-code",
				class:
					"grid min-h-lh min-w-max content-start in-data-numbered:grid-cols-[auto_1fr] in-data-wrap:min-w-0",
			},
			...lines,
		),
	);
});

/**
 * One line of code. Use these yourself to mark lines `added`, `removed`, or
 * `highlighted`, or to render the lines `highlightedCode` hands back.
 */
export const CodeBlockLine = createComponent(function CodeBlockLine(
	{ class: className, variant = "default", ...props }: CodeBlockLineProps,
	...children: Child[]
) {
	// an empty line holds a newline, so copying a selection keeps blank lines
	const empty = children.every((child) => child === "" || child === null || child === undefined);
	const content: Child[] = empty
		? ["\n"]
		: children.map((child) =>
				isReadable<PrimitiveChild>(child)
					? child.bind((value) =>
							value === "" || value === null || value === undefined ? "\n" : String(value),
						)
					: child,
			);

	return Span(
		{
			...props,
			"data-slot": "code-block-line",
			"data-variant": variant,
			class: cn(codeBlockLineVariants({ variant }), className),
		},
		Span({ "data-slot": "code-block-line-content", class: "min-w-0" }, ...content),
	);
});

/** A row under the code, for a caption, a status, or more actions. */
export const CodeBlockFooter = createComponent(function CodeBlockFooter(
	{ class: className, ...props }: CodeBlockFooterProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "code-block-footer",
			class: cn(
				"flex min-w-0 shrink-0 items-center gap-2 px-4 pb-4 text-muted-foreground group-data-[size=sm]/code-block:px-3 group-data-[size=sm]/code-block:pb-3",
				className,
			),
		},
		...children,
	);
});
