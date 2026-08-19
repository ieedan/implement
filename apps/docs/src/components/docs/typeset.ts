import { App, Div, Html, Implement, type Mountable } from "@implementjs/core";
import { apiReference } from "../../lib/api-reference";
import { copyText } from "../../lib/copy-text";
import { demos } from "../demos";
import { EditableDemo } from "../demos/editable-demo";
import { ApiReference } from "./api-reference";
import { icons } from "../tutorials/icons";
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
	button.innerHTML = icons.copy;

	let timeout: number | undefined;
	button.addEventListener("click", async () => {
		if (!(await copyText(pre.textContent?.replace(/\n$/, "") ?? ""))) return;
		button.innerHTML = icons.check;
		button.ariaLabel = "Copied";
		clearTimeout(timeout);
		timeout = window.setTimeout(() => {
			button.innerHTML = icons.copy;
			button.ariaLabel = "Copy code";
		}, 1500);
	});
	wrapper.append(button);
}

/**
 * Markdown-rendered HTML in typeset styles, with a copy button on each code
 * block. A `<div data-demo="name"></div>` in the markdown mounts an editable
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
					for (const pre of parent.querySelectorAll("pre")) addCopyButton(pre);

					const unmounts: (() => void)[] = [];
					for (const target of parent.querySelectorAll<HTMLElement>("[data-demo]")) {
						const source = demos[target.dataset.demo ?? ""];
						if (source == null) continue;
						// demos style themselves; opt the subtree out of typeset styles
						target.setAttribute("data-not-typeset", "");
						unmounts.push(App({ target }).render(EditableDemo(source)));
					}
					for (const target of parent.querySelectorAll<HTMLElement>("[data-api]")) {
						const parts = apiReference[target.dataset.api ?? ""];
						if (parts == null) continue;
						// the tables style themselves; opt the subtree out of typeset styles
						target.setAttribute("data-not-typeset", "");
						unmounts.push(App({ target }).render(ApiReference(parts)));
					}
					return () => {
						for (const unmount of unmounts) unmount();
					};
				},
			},
			Html(content),
		),
	);
}
