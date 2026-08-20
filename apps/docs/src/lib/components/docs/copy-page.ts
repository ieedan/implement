import { Div, If, signal, type Mountable } from "@implementjs/core";
import {
	CheckIcon,
	ChevronDownIcon,
	CopyIcon,
	ExternalLinkIcon,
	FileTextIcon,
} from "@implementjs/lucide";
import { copyText } from "@/lib/copy-text";
import { Button } from "../ui/button";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../ui/popover";

const itemClass = "w-full justify-start gap-2 font-normal";

/**
 * The page-tools split button on every docs page: "Copy Page" copies the
 * page's plain-markdown twin (the `.md` server route kit serves next to the
 * page), and the dropdown opens that markdown directly or hands it to an
 * assistant. Dogfoods kit's extension server routes.
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
		Popover(
			{},
			PopoverTrigger(
				{
					variant: "outline",
					size: "sm",
					class: "rounded-l-none border-l-0 px-2",
					"aria-label": "More ways to read this page",
				},
				ChevronDownIcon({ class: "size-3.5" }),
			),
			PopoverPortal(
				PopoverContent(
					{ class: "w-56 p-1", align: "end" },
					PopoverClose(
						{
							class: itemClass,
							onClick: () => window.open(mdPath, "_blank", "noopener"),
						},
						FileTextIcon({ class: "size-4 text-foreground/60" }),
						"View as Markdown",
					),
					PopoverClose(
						{
							class: itemClass,
							onClick: () => openPrompt("https://chatgpt.com/?hints=search&q="),
						},
						ExternalLinkIcon({ class: "size-4 text-foreground/60" }),
						"Open in ChatGPT",
					),
					PopoverClose(
						{
							class: itemClass,
							onClick: () => openPrompt("https://claude.ai/new?q="),
						},
						ExternalLinkIcon({ class: "size-4 text-foreground/60" }),
						"Open in Claude",
					),
				),
			),
		),
	);
}
