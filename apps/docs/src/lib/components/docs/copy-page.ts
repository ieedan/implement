import { Div, If, signal, type Mountable } from "@implementjs/core";
import { CheckIcon, ChevronDownIcon, CopyIcon, ExternalLinkIcon } from "@implementjs/lucide";
import { ClaudeIcon, MarkdownIcon, OpenAIIcon } from "./brand-icons";
import { copyText } from "@/lib/copy-text";
import { Button } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * The page-tools split button on every docs page: "Copy Page" copies the
 * page's plain-markdown twin (the `.md` server route kit serves next to the
 * page), and the dropdown opens that markdown directly or hands it to an
 * assistant. Dogfoods kit's extension server routes and the DropdownMenu
 * primitive.
 */
export function CopyPage(permalink: string): Mountable {
	const mdPath = `${permalink}.md`;
	const copied = signal(false);
	let timeout: ReturnType<typeof setTimeout> | undefined;

	const copy = async () => {
		const response = await fetch(mdPath);
		if (!response.ok) return;
		if (!(await copyText(await response.text()))) return;
		copied.set(true);
		clearTimeout(timeout);
		timeout = setTimeout(() => copied.set(false), 1500);
	};

	const openPrompt = (base: string) => {
		const prompt = encodeURIComponent(`Read ${window.location.origin}${mdPath}`);
		window.open(`${base}${prompt}`, "_blank", "noopener");
	};

	return Div(
		{ class: "flex items-center" },
		Button(
			{
				variant: "outline",
				size: "sm",
				class: "rounded-r-none",
				onClick: () => void copy(),
			},
			If(copied)
				.Then(CheckIcon({ class: "size-3.5" }))
				.Else(CopyIcon({ class: "size-3.5" })),
			"Copy Page",
		),
		DropdownMenu(
			{},
			DropdownMenuTrigger(
				{
					size: "sm",
					class: "rounded-l-none border-l-0 px-2",
					"aria-label": "More ways to read this page",
				},
				ChevronDownIcon({ class: "size-3.5" }),
			),
			DropdownMenuContent(
				{ class: "w-56", align: "end" },
				DropdownMenuItem(
					{ onSelect: () => window.open(mdPath, "_blank", "noopener") },
					MarkdownIcon({ class: "size-4 text-foreground/60", "aria-hidden": true }),
					"View as Markdown",
				),
				DropdownMenuItem(
					{ onSelect: () => openPrompt("https://chatgpt.com/?hints=search&q=") },
					OpenAIIcon({ class: "size-4", "aria-hidden": true }),
					"Open in ChatGPT",
					ExternalLinkIcon({ class: "size-4 ml-auto text-muted-foreground", "aria-hidden": true }),
				),
				DropdownMenuItem(
					{ onSelect: () => openPrompt("https://claude.ai/new?q=") },
					ClaudeIcon({ class: "size-4", "aria-hidden": true }),
					"Open in Claude",
					ExternalLinkIcon({ class: "size-4 ml-auto text-muted-foreground", "aria-hidden": true }),
				),
			),
		),
	);
}
