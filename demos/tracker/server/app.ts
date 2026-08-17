import { $, createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { db } from "./db";

export const API_PORT = 4003;

export const openapiConfig = {
	openapi: "3.1.0",
	info: {
		title: "Tracker API",
		version: "1.0.0",
	},
};

const IDENTIFIER_PREFIX = "TRK";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const StatusSchema = z
	.enum(["backlog", "todo", "in_progress", "done", "canceled"])
	.openapi("Status");

const PrioritySchema = z.enum(["none", "urgent", "high", "medium", "low"]).openapi("Priority");

const IssueSchema = z
	.object({
		id: z.string(),
		identifier: z.string(),
		number: z.number(),
		title: z.string(),
		description: z.string(),
		status: StatusSchema,
		priority: PrioritySchema,
		assigneeId: z.string().nullable(),
		labelIds: z.array(z.string()),
		commentCount: z.number(),
		createdAt: z.number(),
		updatedAt: z.number(),
	})
	.openapi("Issue");

const CreateIssueSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: StatusSchema.optional(),
	priority: PrioritySchema.optional(),
	assigneeId: z.string().nullable().optional(),
	labelIds: z.array(z.string()).optional(),
});

const UpdateIssueSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: StatusSchema.optional(),
	priority: PrioritySchema.optional(),
	assigneeId: z.string().nullable().optional(),
	labelIds: z.array(z.string()).optional(),
});

const UserSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		color: z.string(),
	})
	.openapi("User");

const LabelSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		color: z.string(),
	})
	.openapi("Label");

const CommentSchema = z
	.object({
		id: z.string(),
		issueId: z.string(),
		authorId: z.string(),
		body: z.string(),
		createdAt: z.number(),
	})
	.openapi("Comment");

const CreateCommentSchema = z.object({
	authorId: z.string(),
	body: z.string().min(1),
});

const ErrorSchema = z
	.object({
		message: z.string(),
	})
	.openapi("Error");

const IdParamSchema = z.object({
	id: z.string().openapi({
		param: {
			name: "id",
			in: "path",
		},
	}),
});

type Issue = z.infer<typeof IssueSchema>;
type Comment = z.infer<typeof CommentSchema>;

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

type IssueRow = {
	id: string;
	number: number;
	title: string;
	description: string;
	status: Issue["status"];
	priority: Issue["priority"];
	assignee_id: string | null;
	created_at: number;
	updated_at: number;
};

function toIssue(row: IssueRow): Issue {
	const labelRows = db
		.prepare("SELECT label_id FROM issue_labels WHERE issue_id = ?")
		.all(row.id) as Array<{ label_id: string }>;
	const commentCount = db
		.prepare("SELECT COUNT(*) AS count FROM comments WHERE issue_id = ?")
		.get(row.id) as { count: number };

	return {
		id: row.id,
		identifier: `${IDENTIFIER_PREFIX}-${row.number}`,
		number: row.number,
		title: row.title,
		description: row.description,
		status: row.status,
		priority: row.priority,
		assigneeId: row.assignee_id,
		labelIds: labelRows.map((label) => label.label_id),
		commentCount: commentCount.count,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function getIssueRow(id: string): IssueRow | undefined {
	return db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as IssueRow | undefined;
}

function setIssueLabels(issueId: string, labelIds: string[]) {
	db.prepare("DELETE FROM issue_labels WHERE issue_id = ?").run(issueId);
	const insert = db.prepare("INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)");
	for (const labelId of labelIds) insert.run(issueId, labelId);
}

type CommentRow = {
	id: string;
	issue_id: string;
	author_id: string;
	body: string;
	created_at: number;
};

function toComment(row: CommentRow): Comment {
	return {
		id: row.id,
		issueId: row.issue_id,
		authorId: row.author_id,
		body: row.body,
		createdAt: row.created_at,
	};
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listIssuesRoute = createRoute({
	method: "get",
	path: "/issues",
	operationId: "issues.list",
	responses: {
		200: {
			description: "All issues",
			content: {
				"application/json": {
					schema: z.array(IssueSchema),
				},
			},
		},
	},
});

const createIssueRoute = createRoute({
	method: "post",
	path: "/issues",
	operationId: "issues.create",
	request: {
		body: {
			required: true,
			content: {
				"application/json": {
					schema: CreateIssueSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created issue",
			content: {
				"application/json": {
					schema: IssueSchema,
				},
			},
		},
	},
});

const updateIssueRoute = createRoute({
	method: "patch",
	path: "/issues/{id}",
	operationId: "issues.update",
	request: {
		params: IdParamSchema,
		body: {
			required: true,
			content: {
				"application/json": {
					schema: UpdateIssueSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Updated issue",
			content: {
				"application/json": {
					schema: IssueSchema,
				},
			},
		},
		404: {
			description: "Issue not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const deleteIssueRoute = createRoute({
	method: "delete",
	path: "/issues/{id}",
	operationId: "issues.delete",
	request: {
		params: IdParamSchema,
	},
	responses: {
		204: {
			description: "Deleted",
		},
		404: {
			description: "Issue not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const listUsersRoute = createRoute({
	method: "get",
	path: "/users",
	operationId: "users.list",
	responses: {
		200: {
			description: "All users",
			content: {
				"application/json": {
					schema: z.array(UserSchema),
				},
			},
		},
	},
});

const listLabelsRoute = createRoute({
	method: "get",
	path: "/labels",
	operationId: "labels.list",
	responses: {
		200: {
			description: "All labels",
			content: {
				"application/json": {
					schema: z.array(LabelSchema),
				},
			},
		},
	},
});

const listCommentsRoute = createRoute({
	method: "get",
	path: "/issues/{id}/comments",
	operationId: "comments.list",
	request: {
		params: IdParamSchema,
	},
	responses: {
		200: {
			description: "Comments for an issue",
			content: {
				"application/json": {
					schema: z.array(CommentSchema),
				},
			},
		},
		404: {
			description: "Issue not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const createCommentRoute = createRoute({
	method: "post",
	path: "/issues/{id}/comments",
	operationId: "comments.create",
	request: {
		params: IdParamSchema,
		body: {
			required: true,
			content: {
				"application/json": {
					schema: CreateCommentSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created comment",
			content: {
				"application/json": {
					schema: CommentSchema,
				},
			},
		},
		404: {
			description: "Issue not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const deleteCommentRoute = createRoute({
	method: "delete",
	path: "/comments/{id}",
	operationId: "comments.delete",
	request: {
		params: IdParamSchema,
	},
	responses: {
		204: {
			description: "Deleted",
		},
		404: {
			description: "Comment not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const app = $(
	new OpenAPIHono().use(
		"*",
		cors({
			// any localhost port, so the static build can be previewed from a
			// different port than the dev server
			origin: (origin) => (/^http:\/\/localhost:\d+$/.test(origin) ? origin : null),
		}),
	),
);

app.openapi(listIssuesRoute, (c) => {
	const rows = db.prepare("SELECT * FROM issues ORDER BY number DESC").all() as IssueRow[];
	return c.json(rows.map(toIssue), 200);
});

app.openapi(createIssueRoute, (c) => {
	const body = c.req.valid("json");
	const id = crypto.randomUUID();
	const now = Date.now();
	const next = db.prepare("SELECT COALESCE(MAX(number), 0) + 1 AS next FROM issues").get() as {
		next: number;
	};

	db.prepare(
		"INSERT INTO issues (id, number, title, description, status, priority, assignee_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	).run(
		id,
		next.next,
		body.title,
		body.description ?? "",
		body.status ?? "todo",
		body.priority ?? "none",
		body.assigneeId ?? null,
		now,
		now,
	);

	if (body.labelIds && body.labelIds.length > 0) {
		setIssueLabels(id, body.labelIds);
	}

	return c.json(toIssue(getIssueRow(id)!), 201);
});

app.openapi(updateIssueRoute, (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");

	const row = getIssueRow(id);
	if (!row) {
		return c.json({ message: "Issue not found" }, 404);
	}

	db.prepare(
		"UPDATE issues SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, updated_at = ? WHERE id = ?",
	).run(
		body.title ?? row.title,
		body.description ?? row.description,
		body.status ?? row.status,
		body.priority ?? row.priority,
		body.assigneeId === undefined ? row.assignee_id : body.assigneeId,
		Date.now(),
		id,
	);

	if (body.labelIds) {
		setIssueLabels(id, body.labelIds);
	}

	return c.json(toIssue(getIssueRow(id)!), 200);
});

app.openapi(deleteIssueRoute, (c) => {
	const { id } = c.req.valid("param");
	const result = db.prepare("DELETE FROM issues WHERE id = ?").run(id);
	if (result.changes === 0) {
		return c.json({ message: "Issue not found" }, 404);
	}
	return c.body(null, 204);
});

app.openapi(listUsersRoute, (c) => {
	const rows = db.prepare("SELECT * FROM users ORDER BY name").all() as Array<{
		id: string;
		name: string;
		color: string;
	}>;
	return c.json(rows, 200);
});

app.openapi(listLabelsRoute, (c) => {
	const rows = db.prepare("SELECT * FROM labels ORDER BY name").all() as Array<{
		id: string;
		name: string;
		color: string;
	}>;
	return c.json(rows, 200);
});

app.openapi(listCommentsRoute, (c) => {
	const { id } = c.req.valid("param");
	if (!getIssueRow(id)) {
		return c.json({ message: "Issue not found" }, 404);
	}
	const rows = db
		.prepare("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at")
		.all(id) as CommentRow[];
	return c.json(rows.map(toComment), 200);
});

app.openapi(createCommentRoute, (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	if (!getIssueRow(id)) {
		return c.json({ message: "Issue not found" }, 404);
	}

	const comment: CommentRow = {
		id: crypto.randomUUID(),
		issue_id: id,
		author_id: body.authorId,
		body: body.body,
		created_at: Date.now(),
	};
	db.prepare(
		"INSERT INTO comments (id, issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
	).run(comment.id, comment.issue_id, comment.author_id, comment.body, comment.created_at);

	return c.json(toComment(comment), 201);
});

app.openapi(deleteCommentRoute, (c) => {
	const { id } = c.req.valid("param");
	const result = db.prepare("DELETE FROM comments WHERE id = ?").run(id);
	if (result.changes === 0) {
		return c.json({ message: "Comment not found" }, 404);
	}
	return c.body(null, 204);
});

app.doc31("/openapi.json", openapiConfig);
