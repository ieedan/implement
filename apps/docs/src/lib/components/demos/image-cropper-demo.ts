import { Div, signal } from "@implementjs/core";
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

export default function ImageCropperDemo() {
	const src = signal("https://github.com/ieedan.png");

	return Div(
		{ class: "flex justify-center" },
		ImageCropper(
			{ src },
			ImageCropperTrigger(ImageCropperPreview()),
			ImageCropperDialog(
				ImageCropperCropper(),
				ImageCropperControls(ImageCropperCrop(), ImageCropperCancel()),
			),
		),
	);
}
