import { expect, screen, source, userEvent } from "@tutorial/test";

export default async function test() {
	expect(source(), "Render the status with the Switch helper.").toMatch(/\bSwitch\s*\(/);
	expect(source(), 'Add a .Case() for "loading" and "success".').toMatch(/\.Case\s*\(/);
	expect(source(), "Add a .Default() for any other status.").toMatch(/\.Default\s*\(/);

	const button = screen.getByRole("button");
	const initial = screen.container.textContent;
	await userEvent.click(button);
	expect(
		screen.container.textContent,
		"Clicking the button should switch the rendered branch — each status should show its own content.",
	).not.toBe(initial);
	await userEvent.click(button);
	await userEvent.click(button);
	expect(
		screen.container.textContent,
		"After cycling through every status the first branch should be mounted again.",
	).toBe(initial);
}
