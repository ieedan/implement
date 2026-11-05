import { Div, Img, signal, Span } from "@implementjs/core";
import {
	ImageCropper,
	ImageCropperCancel,
	ImageCropperControls,
	ImageCropperCrop,
	ImageCropperCropper,
	ImageCropperDialog,
	ImageCropperPreview,
	ImageCropperTrigger,
} from "@/lib/components/ui/image-cropper";

export default function ImageCropperWideDemo() {
	const src = signal("");

	return Div(
		{ class: "flex justify-center" },
		ImageCropper(
			{ src },
			ImageCropperTrigger(
				ImageCropperPreview({
					child: (url) =>
						Div(
							{
								class:
									"flex aspect-video w-64 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted text-sm text-muted-foreground",
							},
							Span(
								{ class: url.bind((current) => (current === "" ? "" : "hidden")) },
								"Choose a cover image",
							),
							Img({
								src: url.bind((current) => current || undefined),
								alt: "Cover",
								class: url.bind((current) =>
									current === "" ? "hidden" : "size-full object-cover",
								),
							}),
						),
				}),
			),
			ImageCropperDialog(
				ImageCropperCropper({ aspect: 16 / 9, shape: "rect" }),
				ImageCropperControls(ImageCropperCrop(), ImageCropperCancel()),
			),
		),
	);
}
