import { derived, signal } from "@packages/ui_v2";
import { Api, type Issue, type Label, type Priority, type Status, type User } from "../api";

export const api = new Api();

// ---------------------------------------------------------------------------
// Workspace data
// ---------------------------------------------------------------------------

export const issues = signal<Issue[]>([]);
export const users = signal<User[]>([]);
export const labels = signal<Label[]>([]);

/** The signed-in user. There is no auth; the seed's first user plays the part. */
export const currentUser = signal<User | null>(null);

export const usersById = derived([users], (users) => new Map(users.map((user) => [user.id, user])));

export const labelsById = derived(
	[labels],
	(labels) => new Map(labels.map((label) => [label.id, label])),
);

/** Loads everything the app needs up front. The UI gates on this via Await. */
export async function loadWorkspace(): Promise<void> {
	const [issuesResult, usersResult, labelsResult] = await Promise.all([
		api.issues.list(),
		api.users.list(),
		api.labels.list(),
	]);

	const failed = issuesResult.error ?? usersResult.error ?? labelsResult.error;
	if (failed) throw new Error("Failed to load workspace. Is the API running on :4003?");

	issues.set(issuesResult.data ?? []);
	users.set(usersResult.data ?? []);
	labels.set(labelsResult.data ?? []);
	currentUser.set(usersResult.data?.find((user) => user.name === "Aidan Bleser") ?? null);
}

// ---------------------------------------------------------------------------
// Issue mutations (optimistic, with rollback on failure)
// ---------------------------------------------------------------------------

export type IssuePatch = {
	title?: string;
	description?: string;
	status?: Status;
	priority?: Priority;
	assigneeId?: string | null;
	labelIds?: string[];
};

export async function updateIssue(id: string, patch: IssuePatch): Promise<boolean> {
	const previous = issues.get();
	issues.set(
		previous.map((issue) =>
			issue.id === id ? { ...issue, ...patch, updatedAt: Date.now() } : issue,
		),
	);

	const { data, error } = await api.issues.update({ id, ...patch });
	if (error || !data) {
		issues.set(previous);
		return false;
	}

	issues.update((list) => list.map((issue) => (issue.id === id ? data : issue)));
	return true;
}

export type CreateIssueInput = {
	title: string;
	description?: string;
	status?: Status;
	priority?: Priority;
	assigneeId?: string | null;
	labelIds?: string[];
};

export async function createIssue(input: CreateIssueInput): Promise<Issue | null> {
	const { data, error } = await api.issues.create(input);
	if (error || !data) return null;
	issues.unshift(data);
	return data;
}

export async function deleteIssue(id: string): Promise<boolean> {
	const previous = issues.get();
	issues.set(previous.filter((issue) => issue.id !== id));

	const { error } = await api.issues.delete({ id });
	if (error) {
		issues.set(previous);
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function bumpCommentCount(issueId: string, delta: number) {
	issues.update((list) =>
		list.map((issue) =>
			issue.id === issueId ? { ...issue, commentCount: issue.commentCount + delta } : issue,
		),
	);
}
