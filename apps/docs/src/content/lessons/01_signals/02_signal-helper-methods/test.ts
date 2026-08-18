import { expect, screen, userEvent } from "@tutorial/test";

function readItems(element: HTMLElement): unknown[] | null {
	try {
		const parsed: unknown = JSON.parse(element.textContent ?? "");
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export default async function test() {
	const button = screen.getByRole("button");
	const display = screen.get("p", "the P element that displays the items");
	const before = readItems(display);
	expect(before, "The paragraph should display the items array.").not.toBeNull();
	const count = before?.length ?? 0;
	await userEvent.click(button);
	expect(
		readItems(display),
		"Clicking the button should add an item to items — try items.push() inside addItem.",
	).toHaveLength(count + 1);
	await userEvent.click(button);
	expect(readItems(display), "Each click should add another item.").toHaveLength(count + 2);
}
