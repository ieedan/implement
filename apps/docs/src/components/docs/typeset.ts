import { Div, Html, Implement, type Child, type Mountable } from "@implementjs/core";
import { apiReference } from "../../lib/api-reference";
import { copyText } from "../../lib/copy-text";
import { demos } from "../demos";
import { EditableDemo } from "../demos/editable-demo";
import { ApiReference } from "./api-reference";
import { CheckIcon, CopyIcon, type IconComponent } from "@implementjs/lucide";
import { buttonVariants } from "../ui/button";

const copyButtonClass = [
	buttonVariants({ variant: "ghost", size: "icon-xs" }),
	"absolute top-1.5 right-1.5 text-foreground/60 opacity-0 transition-opacity",
	"group-hover/code:opacity-100 focus-visible:opacity-100",
].join(" ");

function addCopyButton(pre: HTMLPreElement) {
	const wrapper = document.createElement("div");
	wrapper.className = "group/code relative";
	pre.replaceWith(wrapper);
	wrapper.append(pre);

	const button = document.createElement("button");
	button.type = "button";
	button.className = copyButtonClass;
	button.ariaLabel = "Copy code";

	let icon = CopyIcon()();
	icon.mount(button);
	const setIcon = (next: IconComponent) => {
		icon.unmount();
		icon = next()();
		icon.mount(button);
	};

	let timeout: number | undefined;
	button.addEventListener("click", async () => {
		if (!(await copyText(pre.textContent?.replace(/\n$/, "") ?? ""))) return;
		setIcon(CheckIcon);
		button.ariaLabel = "Copied";
		clearTimeout(timeout);
		timeout = window.setTimeout(() => {
			setIcon(CopyIcon);
			button.ariaLabel = "Copy code";
		}, 1500);
	});
	wrapper.append(button);
}

// The literal form the placeholders keep through the markdown pipeline.
const placeholderPattern = /<div data-(demo|api)="([^"]+)"><\/div>/g;

// demos and api tables style themselves; data-not-typeset opts the subtree
// out of typeset styles
function DemoPlaceholder(name: string): Mountable | null {
	const demo = demos[name];
	if (demo == null) return null;
	return Div({ "data-demo": name, "data-not-typeset": "" }, EditableDemo(demo));
}

function ApiPlaceholder(name: string): Mountable | null {
	const parts = apiReference[name];
	if (parts == null) return null;
	return Div({ "data-api": name, "data-not-typeset": "" }, ApiReference(parts));
}

// Splits the rendered markdown at its `data-demo`/`data-api` placeholders and
// interleaves the real components as children, so they are part of the render
// itself — and therefore of the server render — instead of DOM patched in
// after mount.
function contentChildren(content: string): Child[] {
	const children: Child[] = [];
	let last = 0;
	for (const match of content.matchAll(placeholderPattern)) {
		const [placeholder, kind, name = ""] = match;
		const replacement = kind === "demo" ? DemoPlaceholder(name) : ApiPlaceholder(name);
		// unregistered name: leave the placeholder in the surrounding html
		if (replacement == null) continue;
		if (match.index > last) children.push(Html(content.slice(last, match.index)));
		children.push(replacement);
		last = match.index + placeholder.length;
	}
	if (last < content.length) children.push(Html(content.slice(last)));
	return children;
}

/**
 * Markdown-rendered HTML in typeset styles, with a copy button on each code
 * block. A `<div data-demo="name"></div>` in the markdown renders an editable
 * live demo of the matching source from the {@link demos} registry at that
 * spot, and a `<div data-api="name"></div>` renders that primitive's
 * {@link apiReference} tables.
 */
export function Typeset(content: string, className?: string): Mountable {
	return Div(
		{ class: ["typeset", className] },
		Implement.Lifecycle(
			{
				onMount(parent) {
					for (const pre of parent.querySelectorAll("pre")) {
						// only markdown code blocks — not e.g. pres inside demos
						if (pre.closest("[data-not-typeset]")) continue;
						addCopyButton(pre);
					}
				},
			},
			...contentChildren(content),
		),
	);
}
