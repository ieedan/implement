import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createForm, getInput } from "../src/index";

describe("schema coverage", () => {
	it("walks every branch of a union, sharing one field per key", () => {
		const Schema = v.object({
			payment: v.union([
				v.object({ kind: v.literal("card"), number: v.string() }),
				v.object({ kind: v.literal("cash") }),
			]),
		});
		// the branches share a field store per key, so a key only one of them has
		// is still addressable; where they disagree, the last branch wins
		expect(getInput(createForm({ schema: Schema }))).toEqual({
			payment: { kind: undefined, number: "" },
		});
	});

	it("refuses a schema whose fields cannot be known up front", () => {
		expect(() =>
			createForm({ schema: v.object({ meta: v.record(v.string(), v.string()) }) }),
		).toThrow('"record" schema is not supported');
	});

	it("starts a nullable field at null and leaves an exact optional absent", () => {
		const Schema = v.object({
			middle: v.nullable(v.string()),
			exact: v.exactOptional(v.string()),
		});
		const input = getInput(createForm({ schema: Schema }));
		expect(input).toEqual({ middle: null });
		expect(Object.keys(input)).not.toContain("exact");
	});
});
