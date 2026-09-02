import * as v from "valibot";
import { mcp, tool } from "@implementjs/kit/mcp";

const createIssue = tool({
	name: "create_issue",
	description: "File an issue.",
	input: v.object({
		title: v.pipe(v.string(), v.minLength(1)),
		labels: v.optional(v.array(v.string())),
	}),
	handle: ({ input }) => ({ filed: input.title }),
});

export const { POST, GET, DELETE } = mcp({
	serverInfo: { name: "mcp-app", version: "1.0.0" },
	tools: [createIssue],
});

export const openapi = false;
export const prerender = false;
