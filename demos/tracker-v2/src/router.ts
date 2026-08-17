import { Router } from "@packages/ui_v2";
import { IssueDetailView } from "./views/issue-detail";
import { IssueListView } from "./views/issue-list";
import { NotFound } from "./views/not-found";
import { AppShell } from "./views/shell";

/**
 * The whole app in one route table. The root `layout` mounts once and
 * survives navigation; `:view` and `:id` arrive at the views as
 * `Readable<string>`s. Links and `navigate` are typed against this table.
 */
export const router = Router(
	{
		layout: (child) => AppShell(child),
		"/": () => IssueListView(null),
		"/views": {
			"/:view": {
				"/": ({ view }) => IssueListView(view),
			},
		},
		"/issues": {
			"/:id": {
				"/": ({ id }) => IssueDetailView(id),
			},
		},
	},
	{ fallback: () => NotFound() },
);
