import { Div, If } from "@packages/ui";
import { Sidebar } from "../components/sidebar";
import { route } from "../lib/router";
import { createDialogOpen, openCreateDialog } from "../state/ui";
import { CreateIssueDialog } from "./create-issue";
import { IssueDetailHost } from "./issue-detail";
import { IssueListView } from "./issue-list";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function App() {
	// Global shortcut: "c" opens the create dialog (matching Linear).
	document.addEventListener("keydown", (e) => {
		if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
		if (isTypingTarget(e.target) || createDialogOpen.get()) return;
		e.preventDefault();
		openCreateDialog();
	});

	return Div(
		Sidebar(),
		Div(
			If([route], (route) => route.name === "list").Then(IssueListView()),
			IssueDetailHost(),
		).className("flex min-w-0 flex-1 flex-col overflow-hidden"),
		CreateIssueDialog(),
	).className("flex h-dvh overflow-hidden");
}
