import { Div, Span, type Child, type ComponentProps, type Readable } from "@implementjs/core";
import { CropIcon, Trash2Icon, UploadIcon } from "@implementjs/lucide";
import {
	createComponent,
	ImageCropper as ImageCropperPrimitive,
	ImageCropperCancel as ImageCropperCancelPrimitive,
	ImageCropperContext,
	ImageCropperCrop as ImageCropperCropPrimitive,
	ImageCropperCropper as ImageCropperCropperPrimitive,
	ImageCropperTrigger as ImageCropperTriggerPrimitive,
} from "@implementjs/primitives";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

export { getFileFromUrl } from "@implementjs/primitives";

export type ImageCropperProps = ComponentProps<typeof ImageCropperPrimitive>;
export type ImageCropperTriggerProps = ComponentProps<typeof ImageCropperTriggerPrimitive>;
export type ImageCropperPreviewProps = ComponentProps<typeof Avatar> & {
	/** Draw the picture yourself instead of in a round avatar. It is handed the current `src`. */
	child?: (src: Readable<string>) => Child;
};
export type ImageCropperDialogProps = ComponentProps<typeof DialogContent>;
export type ImageCropperCropperProps = ComponentProps<typeof ImageCropperCropperPrimitive>;
export type ImageCropperControlsProps = ComponentProps<typeof Div>;
export type ImageCropperCropProps = ComponentProps<typeof ImageCropperCropPrimitive> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
};
export type ImageCropperCancelProps = ComponentProps<typeof ImageCropperCancelPrimitive> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
};

export const ImageCropper = createComponent(function ImageCropper(
	props: ImageCropperProps,
	...children: Child[]
) {
	return ImageCropperPrimitive(props, ...children);
});

export const ImageCropperTrigger = createComponent(function ImageCropperTrigger(
	{ class: className, ...props }: ImageCropperTriggerProps,
	...children: Child[]
) {
	return ImageCropperTriggerPrimitive(
		{ ...props, "data-slot": "image-cropper-trigger", class: cn("cursor-pointer", className) },
		...children,
	);
});

export const ImageCropperPreview = createComponent(function ImageCropperPreview({
	child,
	class: className,
	...props
}: ImageCropperPreviewProps) {
	return ImageCropperContext.Use((state) =>
		child
			? child(state.src)
			: Avatar(
					{
						...props,
						"data-slot": "image-cropper-preview",
						class: cn("size-20 ring-2 ring-accent ring-offset-2 ring-offset-background", className),
					},
					AvatarImage({ src: state.src, alt: "" }),
					AvatarFallback(
						UploadIcon({ class: "size-4", "aria-hidden": true }),
						Span({ class: "sr-only" }, "Upload image"),
					),
				),
	);
});

/** The modal the picture is cropped in. It opens when a file is chosen. */
export const ImageCropperDialog = createComponent(function ImageCropperDialog(
	{ class: className, ...props }: ImageCropperDialogProps,
	...children: Child[]
) {
	return ImageCropperContext.Use((state) =>
		Dialog(
			{ open: state.open },
			DialogContent(
				{
					showCloseButton: false,
					...props,
					"data-slot": "image-cropper-dialog",
					class: cn(
						"max-w-full rounded-none border-x-0 sm:max-w-lg sm:rounded-lg sm:border-x",
						className,
					),
				},
				DialogTitle({ class: "sr-only" }, "Crop image"),
				...children,
			),
		),
	);
});

export const ImageCropperCropper = createComponent(function ImageCropperCropper({
	class: className,
	...props
}: ImageCropperCropperProps) {
	return ImageCropperCropperPrimitive({
		...props,
		"data-slot": "image-cropper-cropper",
		class: cn(
			"h-72 w-full rounded-md bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
			// the dimmed surround is a huge shadow cast by the crop area
			"[&>[data-image-cropper-area]]:border-2 [&>[data-image-cropper-area]]:border-white/80 [&>[data-image-cropper-area]]:shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]",
			"[&>[data-image-cropper-area][data-shape=round]]:rounded-full",
			"cursor-grab active:cursor-grabbing",
			className,
		),
	});
});

export const ImageCropperControls = createComponent(function ImageCropperControls(
	{ class: className, ...props }: ImageCropperControlsProps,
	...children: Child[]
) {
	return Div(
		{
			...props,
			"data-slot": "image-cropper-controls",
			class: cn("flex w-full items-center justify-center gap-2", className),
		},
		...children,
	);
});

export const ImageCropperCrop = createComponent(function ImageCropperCrop(
	{ class: className, variant = "default", size = "sm", ...props }: ImageCropperCropProps,
	...children: Child[]
) {
	return ImageCropperCropPrimitive(
		{
			...props,
			"data-slot": "image-cropper-crop",
			"data-variant": variant,
			"data-size": size,
			class: cn(buttonVariants({ variant, size }), className),
		},
		...(children.length > 0 ? children : [CropIcon({ "aria-hidden": true }), Span("Crop")]),
	);
});

export const ImageCropperCancel = createComponent(function ImageCropperCancel(
	{ class: className, variant = "outline", size = "sm", ...props }: ImageCropperCancelProps,
	...children: Child[]
) {
	return ImageCropperCancelPrimitive(
		{
			...props,
			"data-slot": "image-cropper-cancel",
			"data-variant": variant,
			"data-size": size,
			class: cn(buttonVariants({ variant, size }), className),
		},
		...(children.length > 0 ? children : [Trash2Icon({ "aria-hidden": true }), Span("Cancel")]),
	);
});
