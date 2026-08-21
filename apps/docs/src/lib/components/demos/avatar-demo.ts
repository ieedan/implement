import { Div } from "@implementjs/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/lib/components/ui/avatar";

export default function AvatarDemo() {
	return Div(
		{ class: "flex flex-row flex-wrap items-center gap-8" },
		Avatar(
			AvatarImage({ src: "https://github.com/ieedan.png", alt: "@ieedan" }),
			AvatarFallback("AB"),
		),
		Avatar(
			AvatarImage({ src: "https://github.com/broken-link-404.png/nope", alt: "broken" }),
			AvatarFallback("ER"),
		),
		Div(
			{
				class:
					"flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:grayscale",
			},
			Avatar(
				AvatarImage({ src: "https://github.com/ieedan.png", alt: "@ieedan" }),
				AvatarFallback("AB"),
			),
			Avatar(
				AvatarImage({ src: "https://github.com/github.png", alt: "@github" }),
				AvatarFallback("GH"),
			),
			Avatar(
				AvatarImage({ src: "https://github.com/shadcn.png", alt: "@shadcn" }),
				AvatarFallback("CN"),
			),
		),
	);
}
