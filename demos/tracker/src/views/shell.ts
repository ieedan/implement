import { Div, Implement, type Child, type Mountable } from "@implementjs/core";
import { Sidebar } from "../components/sidebar";
import { createDialogOpen, openCreateDialog } from "../state/ui";
import { CreateIssueDialog } from "./create-issue";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * Root layout for every route. The router mounts it once and swaps `child`
 * through the outlet, so the sidebar (and the "c" shortcut) survive
 * navigation.
 */
export function AppShell(child: Mountable): Mountable {
	return Div(
		{ class: "flex h-dvh overflow-hidden" },
		// Global shortcut: "c" opens the create dialog (matching Linear).
		Implement.Document({
			onKeydown: (event) => {
				if (event.key !== "c" || event.metaKey || event.ctrlKey || event.altKey) return;
				if (isTypingTarget(event.target) || createDialogOpen.get()) return;
				event.preventDefault();
				openCreateDialog();
			},
		}),
		Sidebar(),
		Div({ class: "flex min-w-0 flex-1 flex-col overflow-hidden" }, child as Child),
		CreateIssueDialog(),
	);
}
