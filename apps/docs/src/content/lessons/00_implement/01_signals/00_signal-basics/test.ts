import { expect, screen, source } from "@tutorial/test";

export default function test() {
	expect(source(), "Create the count with signal() instead of a static value.").toMatch(
		/\bsignal\s*\(/,
	);
}
