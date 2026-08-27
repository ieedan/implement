import { matcher } from "@implementjs/kit/params";

/**
 * A matcher takes a Standard Schema, which is an interface rather than a
 * library — so an app with no schema library still writes one, and this fixture
 * keeps the adapter's dependencies to itself.
 */
export default matcher({
	"~standard": {
		version: 1,
		vendor: "adapter-node-fixture",
		validate: (value: unknown) =>
			typeof value === "string" && /^\d+$/.test(value)
				? { value: Number(value) }
				: { issues: [{ message: "not an integer" }] },
	},
} as const);
