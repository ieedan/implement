import { expect, screen, userEvent } from "@tutorial/test";

const COUNT = /count:\s*(-?\d+)/i;
const DOUBLED = /doubled:\s*(-?\d+)/i;
const COMPUTED = /computed:\s*(-?\d+)/i;

function read(pattern: RegExp, message: string): number {
	const match = pattern.exec(screen.container.textContent ?? "");
	if (match == null) throw new Error(message);
	return Number(match[1]);
}

export default async function test() {
	const missingDerived =
		'Show the derived value as "Doubled: <number>" — or "Computed: <number>" if you built the multiplyBy example.';

	// Accept either the doubled value from the main task, or the full
	// multi-signal computed example from the end of the lesson.
	const usesComputed = COMPUTED.test(screen.container.textContent ?? "");

	const countBefore = read(COUNT, 'The page should show the count as "Count: <number>".');
	const derivedBefore = read(usesComputed ? COMPUTED : DOUBLED, missingDerived);

	if (!usesComputed) {
		expect(
			derivedBefore,
			"Doubled should be twice the count — derive it with derived([count], (count) => count * 2).",
		).toBe(countBefore * 2);
	}

	await userEvent.click(screen.getByRole("button"));

	const countAfter = read(COUNT, 'The page should show the count as "Count: <number>".');
	expect(countAfter, "Clicking the button should still increment the count.").toBe(countBefore + 1);

	const derivedAfter = read(usesComputed ? COMPUTED : DOUBLED, missingDerived);
	if (usesComputed) {
		// The multiplier isn't dictated by the lesson, so infer it instead.
		const multiplier = countBefore !== 0 ? derivedBefore / countBefore : derivedAfter / countAfter;
		expect(
			derivedAfter,
			"Computed should follow the count — it should equal count × multiplyBy after each change.",
		).toBe(countAfter * multiplier);

		const input = screen.queryByRole("textbox");
		if (input != null) {
			await userEvent.fill(input, "3");
			expect(
				read(COMPUTED, missingDerived),
				"Changing Multiply By should recompute the value — derive it from [count, multiplyBy].",
			).toBe(countAfter * 3);
		}
	} else {
		expect(
			derivedAfter,
			"The doubled value should follow the count — derived values update automatically.",
		).toBe(countAfter * 2);
	}
}
