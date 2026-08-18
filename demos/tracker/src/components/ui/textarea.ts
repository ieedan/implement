import { Textarea, type ElementProps, type Mountable } from "@implementjs/core";
import { cx } from "../../lib/cx";

type TextAreaProps = Omit<ElementProps<"textarea">, "class"> & { class?: string };

/** Styled textarea; `value` two-way binds when given a writable signal. */
export function TextArea(props: TextAreaProps): Mountable {
	return Textarea({
		rows: 3,
		...props,
		class: cx(
			"w-full resize-none rounded-md bg-transparent text-[13px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none",
			props.class,
		),
	});
}
