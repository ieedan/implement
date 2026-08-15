import { Signal, Textarea } from "@packages/ui";
import { cx } from "../../lib/cx";

export type TextAreaOptions = {
	value: Signal<string>;
	placeholder?: string;
	rows?: number;
	className?: string;
};

/** Two-way bound textarea over the framework's Textarea bindings. */
export function TextArea(options: TextAreaOptions) {
	return Textarea()
		.className(
			cx(
				"w-full resize-none rounded-md bg-transparent text-[13px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none",
				options.className,
			),
		)
		.value(options.value)
		.placeholder(options.placeholder ?? "")
		.rows(options.rows ?? 3);
}
