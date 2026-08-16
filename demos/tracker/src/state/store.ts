import { Store } from "@packages/ui";
import { Api, type Issue, type Label, type Priority, type Status, type User } from "../api";

export const api = new Api();

// ---------------------------------------------------------------------------
// Workspace data
// ---------------------------------------------------------------------------

/**
 * Reactive store: reading `store.issues` — or any field of an issue pulled
 * out of it — inside a tracked binding (`.content(() => …)`, `If(() => …)`,
 * `new Computed(() => …)`) subscribes to exactly what was read, and mutating
 * it notifies exactly those subscribers. No Signals at the call sites.
 */
class TrackerStore extends Store {
	issues: Issue[] = [];
	users: User[] = [];
	labels: Label[] = [];

	/** The signed-in user. There is no auth; the seed's first user plays the part. */
	currentUser: User | null = null;

	get usersById(): Map<string, User> {
		return new Map(this.users.map((user) => [user.id, user]));
	}

	get labelsById(): Map<string, Label> {
		return new Map(this.labels.map((label) => [label.id, label]));
	}
}

export const store = new TrackerStore();

/** Loads everything the app needs up front. The UI gates on this via Await. */
export async function loadWorkspace(): Promise<void> {
	const [issuesResult, usersResult, labelsResult] = await Promise.all([
		api.issues.list(),
		api.users.list(),
		api.labels.list(),
	]);

	const failed = issuesResult.error ?? usersResult.error ?? labelsResult.error;
	if (failed) throw new Error("Failed to load workspace. Is the API running on :4001?");

	store.issues = issuesResult.data ?? [];
	store.users = usersResult.data ?? [];
	store.labels = labelsResult.data ?? [];
	store.currentUser = usersResult.data?.find((user) => user.name === "Aidan Bleser") ?? null;
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
	const issue = store.issues.find((issue) => issue.id === id);
	if (!issue) return false;

	// mutating the issue in place notifies only the fields that changed
	const previous = { ...issue };
	Object.assign(issue, { ...patch, updatedAt: Date.now() });

	const { data, error } = await api.issues.update({ id, ...patch });
	if (error || !data) {
		Object.assign(issue, previous);
		return false;
	}

	Object.assign(issue, data);
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
	store.issues = [data, ...store.issues];
	return data;
}

export async function deleteIssue(id: string): Promise<boolean> {
	const previous = store.issues;
	store.issues = previous.filter((issue) => issue.id !== id);

	const { error } = await api.issues.delete({ id });
	if (error) {
		store.issues = previous;
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function bumpCommentCount(issueId: string, delta: number) {
	const issue = store.issues.find((issue) => issue.id === issueId);
	if (issue) issue.commentCount += delta;
}
