import { expect, screen, userEvent } from "@tutorial/test";

export default async function test() {
	const button = screen.getByRole("button");
	expect(screen.container, 'The count should start at "Count: 0".').toHaveTextContent(
		/count:\s*0/i,
	);
	await userEvent.click(button);
	expect(
		screen.container,
		"Clicking the button should update the count — update the signal inside handleClick.",
	).toHaveTextContent(/count:\s*1/i);
	await userEvent.click(button);
	expect(
		screen.container,
		"Each click should increase the count — after two clicks it should show 2.",
	).toHaveTextContent(/count:\s*2/i);
}
