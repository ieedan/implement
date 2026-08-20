import { Div, Img } from "@implementjs/core";
import { AspectRatio } from "@/lib/components/ui/aspect-ratio";

export default function AspectRatioDemo() {
	return Div(
		{ class: "w-full max-w-sm" },
		AspectRatio(
			{ ratio: 16 / 9, class: "overflow-hidden rounded-lg bg-muted" },
			Img({
				src: "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80",
				alt: "Photo by Alvaro Pinot",
				class: "size-full object-cover",
			}),
		),
	);
}
