import { $, createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";

export const API_PORT = 4000;

export const openapiConfig = {
	openapi: "3.1.0",
	info: {
		title: "Todo API",
		version: "1.0.0",
	},
};

const TodoSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		timestamp: z.number(),
	})
	.openapi("Todo");

const CreateTodoSchema = z.object({
	title: z.string().min(1),
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

type Todo = z.infer<typeof TodoSchema>;

const todos: Todo[] = [
	{
		id: crypto.randomUUID(),
		title: "Finish the app",
		timestamp: Date.now(),
	},
];

const listTodosRoute = createRoute({
	method: "get",
	path: "/todos",
	operationId: "todos.list",
	responses: {
		200: {
			description: "All todos",
			content: {
				"application/json": {
					schema: z.array(TodoSchema),
				},
			},
		},
	},
});

const createTodoRoute = createRoute({
	method: "post",
	path: "/todos",
	operationId: "todos.create",
	request: {
		body: {
			required: true,
			content: {
				"application/json": {
					schema: CreateTodoSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "Created todo",
			content: {
				"application/json": {
					schema: TodoSchema,
				},
			},
		},
	},
});

const deleteTodoRoute = createRoute({
	method: "delete",
	path: "/todos/{id}",
	operationId: "todos.delete",
	request: {
		params: IdParamSchema,
	},
	responses: {
		204: {
			description: "Deleted",
		},
		404: {
			description: "Todo not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

export const app = $(
	new OpenAPIHono().use(
		"*",
		cors({
			origin: "http://localhost:3000",
		}),
	),
);

app.openapi(listTodosRoute, (c) => c.json(todos, 200));

app.openapi(createTodoRoute, (c) => {
	const { title } = c.req.valid("json");
	const todo: Todo = {
		id: crypto.randomUUID(),
		title,
		timestamp: Date.now(),
	};
	todos.push(todo);
	return c.json(todo, 201);
});

app.openapi(deleteTodoRoute, (c) => {
	const { id } = c.req.valid("param");
	const index = todos.findIndex((todo) => todo.id === id);
	if (index === -1) {
		return c.json({ message: "Todo not found" }, 404);
	}
	todos.splice(index, 1);
	return c.body(null, 204);
});

app.doc31("/openapi.json", openapiConfig);
