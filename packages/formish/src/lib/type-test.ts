import type { Readable } from "@implementjs/core";
import * as v from "valibot";
import { Field, FieldArray } from "./components";
import { useField } from "./field";
import { useFieldArray } from "./field-array";
import { createForm } from "./form";
import {
	getDeepErrors,
	getDirtyInput,
	getDirtyPaths,
	getInput,
	insert,
	isDirty,
	isTouched,
	remove,
	setErrors,
	setInput,
} from "./methods";

/** Only the types matter here — nothing in this file is validated or run. */
const SignUpSchema = v.object({
	email: v.string(),
	age: v.number(),
	profile: v.object({ name: v.string(), nickname: v.optional(v.string()) }),
	todos: v.array(v.object({ label: v.string(), tags: v.array(v.string()) })),
});

const form = createForm({ schema: SignUpSchema });

const email = useField(form, { path: ["email"] });
const age = useField(form, { path: ["age"] });
const label = useField(form, { path: ["todos", 0, "label"] });
const nickname = useField(form, { path: ["profile", "nickname"] });

// the field's value follows the schema
email.input satisfies Readable<string | undefined>;
age.input satisfies Readable<number | undefined>;
label.input satisfies Readable<string | undefined>;
nickname.input satisfies Readable<string | undefined>;

email.onInput("hi@example.com");
age.onInput(42);
// @ts-expect-error a string field does not take a number
email.onInput(42);

// @ts-expect-error not a field of the schema
useField(form, { path: ["nope"] });
// @ts-expect-error a leaf field has nothing below it
useField(form, { path: ["email", "nope"] });

const todos = useFieldArray(form, { path: ["todos"] });
todos.items satisfies Readable<string[]>;
todos.insert({ initialInput: { label: "write docs", tags: [] } });
// @ts-expect-error the item type comes from the schema
todos.insert({ initialInput: { label: 42 } });
todos.remove({ at: 0 });

// @ts-expect-error only array fields have items
useFieldArray(form, { path: ["email"] });
// @ts-expect-error a field array inside an item is still an array path
useFieldArray(form, { path: ["profile", "name"] });
useFieldArray(form, { path: ["todos", 0, "tags"] });

// a row's path follows the item as the list changes, and stays typed
const rowLabel = todos.itemPath(0, "label");
useField(form, { path: rowLabel }).input satisfies Readable<string | undefined>;

insert(form, { path: ["todos"], initialInput: { label: "one", tags: [] } });
remove(form, { path: ["todos"], at: 0 });
// @ts-expect-error a value field cannot be inserted into
insert(form, { path: ["email"] });

getInput(form) satisfies { email: string | undefined };
getInput(form, { path: ["profile", "name"] }) satisfies string | undefined;
setInput(form, { path: ["profile"], input: { name: "Ada" } });
// @ts-expect-error the whole input is written without a path
setInput(form, { input: { email: 42 } });

getDeepErrors(form) satisfies [string, ...string[]] | null;
getDeepErrors(form, { path: ["profile"] }) satisfies [string, ...string[]] | null;
getDirtyInput(form, { path: ["profile"] }) satisfies { name?: string | undefined } | undefined;
getDirtyPaths(form) satisfies readonly (readonly (string | number)[])[];
isDirty(form, { path: ["email"] }) satisfies boolean;
isTouched(form) satisfies boolean;
setErrors(form, { path: ["email"], errors: ["Taken"] });
setErrors(form, { path: ["email"], errors: null });
// @ts-expect-error errors are a non-empty list or null
setErrors(form, { path: ["email"], errors: "Taken" });

Field({ of: form, path: ["email"] }, (field) => {
	field.input satisfies Readable<string | undefined>;
	return null;
});

FieldArray({ of: form, path: ["todos"] }, (field) => {
	field.items satisfies Readable<string[]>;
	return null;
});
