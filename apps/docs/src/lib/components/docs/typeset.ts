import { Div, Html, ImplementLifecycle, type Child, type Mountable } from "@implementjs/core";
import { apiReference } from "@/lib/api-reference";
import { copyText } from "@/lib/copy-text";
import { demos } from "../demos";
import { EditableDemo } from "../demos/editable-demo";
import { ApiReference } from "./api-reference";
import { CheckIcon, CopyIcon, type IconComponent } from "@implementjs/lucide";
import { buttonVariants } from "../ui/button";
import { SourceBlock } from "./source-block";
import { uiSourcePath, uiSources } from "@/lib/ui-sources";
import { TabsBlock, type TabPanel } from "./tabs-block";

function addCopyButton(pre: HTMLPreElement) {
	const wrapper = document.createElement("div");
	wrapper.className = "group/code relative";
	pre.replaceWith(wrapper);
	wrapper.append(pre);

	const button = document.createElement("button");
	button.type = "button";
	button.className = `${buttonVariants({ variant: "ghost", size: "icon-xs" })} absolute top-1.5 right-1.5 text-foreground/60 opacity-0 transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100`;
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

// The literal form the placeholders keep through the markdown pipeline. Extra
// attributes (data-demo-description feeds the `.md` twin) are tolerated.
// `tabs-end` has to precede `tab` in the alternation, or it matches as one.
const placeholderPattern = /<div data-(demo|api|source|tabs-end|tab)(?:="([^"]*)")?[^>]*><\/div>/g;

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

function SourcePlaceholder(name: string): Mountable | null {
	const source = uiSources[name];
	if (source == null) return null;
	return Div(
		{ "data-source": name, "data-not-typeset": "" },
		SourceBlock(uiSourcePath(name), source),
	);
}

// Splits the rendered markdown at its placeholders and interleaves the real
// components as children, so they are part of the render itself — and
// therefore of the server render — instead of DOM patched in after mount.
//
// `data-tab` markers are delimiters rather than a single placeholder: each one
// opens a panel that runs to the next marker, and `data-tabs-end` (or the end
// of the page) closes the group. Panels recurse, so a demo or an API table
// inside a tab still renders.
function contentChildren(content: string): Child[] {
	const children: Child[] = [];
	let last = 0;
	// non-null while a tab group is open
	let panels: TabPanel[] | null = null;
	let panelStart = 0;
	let panelLabel = "";

	const pushHtml = (from: number, to: number) => {
		// `content` is this repo's own markdown, compiled to HTML by Velite at build
		// time. Nothing a visitor sends ever reaches it.
		// oxlint-disable-next-line implementjs/no-html
		if (to > from) children.push(Html(content.slice(from, to)));
	};
	const closePanel = (end: number) => {
		panels?.push({ label: panelLabel, children: contentChildren(content.slice(panelStart, end)) });
	};

	for (const match of content.matchAll(placeholderPattern)) {
		const [placeholder, kind, name = ""] = match;
		const start = match.index;
		const end = start + placeholder.length;

		if (kind === "tab") {
			if (panels === null) {
				pushHtml(last, start);
				panels = [];
			} else closePanel(start);
			panelLabel = name;
			panelStart = end;
			last = end;
			continue;
		}

		if (kind === "tabs-end") {
			// a stray end marker outside a group is left in the surrounding html
			if (panels === null) continue;
			closePanel(start);
			children.push(TabsBlock(panels));
			panels = null;
			last = end;
			continue;
		}

		// inside a group these belong to the panel, which recurses over them
		if (panels !== null) continue;

		const replacement =
			kind === "demo"
				? DemoPlaceholder(name)
				: kind === "source"
					? SourcePlaceholder(name)
					: ApiPlaceholder(name);
		// unregistered name: leave the placeholder in the surrounding html
		if (replacement == null) continue;
		pushHtml(last, start);
		children.push(replacement);
		last = end;
	}

	// an unterminated group runs to the end of the page
	if (panels !== null) {
		closePanel(content.length);
		children.push(TabsBlock(panels));
		last = content.length;
	}

	pushHtml(last, content.length);
	return children;
}

/**
 * Markdown-rendered HTML in typeset styles, with a copy button on each code
 * block. A `<div data-demo="name"></div>` in the markdown renders an editable
 * live demo of the matching source from the {@link demos} registry at that
 * spot, and a `<div data-api="name"></div>` renders that primitive's
 * {@link apiReference} tables. `<div data-source="name"></div>` renders a
 * styled component's own file from {@link uiSources} — a manual install is
 * copying that file, so the page shows the file itself.
 *
 * `<div data-tab="Label"></div>` opens a tab whose content is the markdown
 * that follows it, up to the next tab or a closing
 * `<div data-tabs-end></div>` — consecutive tabs form one group:
 *
 * ```md
 * <div data-tab="Automatic"></div>
 *
 * Run the scaffolder.
 *
 * <div data-tab="Manual"></div>
 *
 * Or install it yourself.
 *
 * <div data-tabs-end></div>
 * ```
 */
export function Typeset(content: string, className?: string): Mountable {
	return Div(
		{ class: ["typeset", className] },
		ImplementLifecycle(
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
