import { Div, Html, Implement, type Mountable } from "@implementjs/core";
import { icons } from "../tutorials/icons";
import { buttonVariants } from "../ui/button";

const copyButtonClass = [
	buttonVariants({ variant: "ghost", size: "icon-xs" }),
	"absolute top-1.5 right-1.5 text-foreground/60 opacity-0 transition-opacity",
	"group-hover/code:opacity-100 focus-visible:opacity-100",
].join(" ");

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// e.g. document not focused, or clipboard API unavailable
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.append(textarea);
		textarea.select();
		const copied = document.execCommand("copy");
		textarea.remove();
		return copied;
	}
}

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

/** Markdown-rendered HTML in typeset styles, with a copy button on each code block. */
export function Typeset(content: string, className?: string): Mountable {
	return Div(
		{ class: ["typeset", className] },
		Implement.Lifecycle(
			{
				onMount(parent) {
					for (const pre of parent.querySelectorAll("pre")) addCopyButton(pre);
				},
			},
			Html(content),
		),
	);
}
