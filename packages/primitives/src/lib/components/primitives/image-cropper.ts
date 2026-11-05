import {
	Button,
	context,
	derived,
	Div,
	Img,
	ImplementLifecycle,
	Input,
	Label,
	ref,
	signal,
	type Child,
	type ComponentProps,
	type ElementProps,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";

/** The image types a browser can draw, and so the ones the cropper accepts. */
export const VALID_IMAGE_TYPES = [
	"image/apng",
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/svg+xml",
	"image/webp",
];

/** The part of the picture to keep, in the picture's own pixels. */
export type CropArea = { x: number; y: number; width: number; height: number };

/** Fetches a URL — like a cropped image's — and wraps it in a `File`, ready to upload. */
export async function getFileFromUrl(url: string, fileName = "cropped.png"): Promise<File> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch resource: ${response.status} ${response.statusText}`);
	}
	const blob = await response.blob();
	return new File([blob], fileName, { type: blob.type });
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", () => reject(new Error("Could not load the image")));
		image.crossOrigin = "anonymous";
		image.src = url;
	});
}

/** Draws `area` of the image at `url` to a PNG and returns an object URL for it. */
export async function getCroppedImage(url: string, area: CropArea): Promise<string> {
	const image = await loadImage(url);
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(area.width));
	canvas.height = Math.max(1, Math.round(area.height));
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Error getting 2d rendering context");
	ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(URL.createObjectURL(blob));
			else reject(new Error("Could not encode the image"));
		}, "image/png");
	});
}

export type ImageCropperRootProps = {
	/** Set on the file input, so a trigger's `for` reaches it. */
	id?: string;
	/** The current image URL. Pass a signal to read the cropped result from outside. */
	src?: Signal<string> | string;
	/** Runs whenever the image URL changes. */
	onSrcChange?: ChangeHandler<string>;
	/** Runs with the object URL of the image once a crop is confirmed. */
	onCropped?: (url: string) => void;
	/** Runs when the chosen file is not an image a browser can draw. */
	onUnsupportedFile?: (file: File) => void;
	/** Whether the crop dialog is open. Pass a signal to control it from outside. */
	open?: Signal<boolean> | boolean;
	/** Runs whenever the open state changes. */
	onOpenChange?: ChangeHandler<boolean>;
	/** Props for the hidden file input. */
	inputProps?: ElementProps<"input">;
};

const ImageCropperCtx = context<ImageCropperState>("ImageCropperCtx");

/** The state behind an image cropper, for parts you write yourself, like the dialog. */
export class ImageCropperState {
	src: Signal<string>;
	open: Signal<boolean>;
	/** The object URL of the picture being cropped. */
	tempUrl = signal("");
	/** Set by the cropper as it moves. */
	pixelCrop: CropArea | null = null;
	private createdUrls: string[] = [];

	constructor(
		readonly id: string,
		src: Signal<string> | string,
		open: Signal<boolean> | boolean,
		private onCroppedHandler: ((url: string) => void) | undefined,
		private onUnsupportedFile: ((file: File) => void) | undefined,
	) {
		this.src = signal(src);
		this.open = signal(open);
	}

	onUpload(file: File) {
		if (!VALID_IMAGE_TYPES.includes(file.type)) {
			this.onUnsupportedFile?.(file);
			return;
		}
		const url = URL.createObjectURL(file);
		this.createdUrls.push(url);
		this.pixelCrop = null;
		this.tempUrl.set(url);
		this.open.set(true);
	}

	/** Closes without changing the image. */
	cancel() {
		this.open.set(false);
		this.tempUrl.set("");
		this.pixelCrop = null;
	}

	/** Crops the picture to what the cropper shows and makes it the new `src`. */
	async crop() {
		const area = this.pixelCrop;
		const url = this.tempUrl.get();
		if (!area || url === "") return;
		const cropped = await getCroppedImage(url, area);
		this.createdUrls.push(cropped);
		this.src.set(cropped);
		this.open.set(false);
		this.onCroppedHandler?.(cropped);
	}

	dispose() {
		for (const url of this.createdUrls) URL.revokeObjectURL(url);
		this.createdUrls = [];
	}
}

/**
 * The root. It has no element of its own: it holds the state and the one
 * hidden file input every trigger points at.
 */
export const ImageCropper = createComponent(function ImageCropper(
	{
		id = getId(),
		src = "",
		onSrcChange,
		onCropped,
		onUnsupportedFile,
		open = false,
		onOpenChange,
		inputProps,
	}: ImageCropperRootProps,
	...children: Child[]
) {
	const state = new ImageCropperState(id, src, open, onCropped, onUnsupportedFile);

	return ImageCropperCtx.Provide(state).To(
		...changeEffect(state.src, onSrcChange),
		...changeEffect(state.open, onOpenChange),
		ImplementLifecycle({ onUnmount: () => state.dispose() }, ...children),
		Input(
			mergeProps(
				{
					id,
					type: "file" as const,
					accept: VALID_IMAGE_TYPES.join(","),
					"data-image-cropper-input": "",
					style: { display: "none" },
					onChange: (e: Event) => {
						const el = e.currentTarget;
						if (!(el instanceof HTMLInputElement)) return;
						const file = el.files?.[0];
						if (!file) return;
						state.onUpload(file);
						// reset so the same file can be chosen again
						el.value = "";
					},
				},
				inputProps ?? {},
			),
		),
	);
});

export type ImageCropperTriggerProps = ComponentProps<typeof Label>;

/** A label for the hidden file input: clicking anything inside it opens the file picker. */
export const ImageCropperTrigger = createComponent(function ImageCropperTrigger(
	props: ImageCropperTriggerProps,
	...children: Child[]
) {
	return ImageCropperCtx.Use((state) =>
		Label(mergeProps({ for: state.id, "data-image-cropper-trigger": "" }, props), ...children),
	);
});

export type ImageCropperCropperProps = ComponentProps<typeof Div> & {
	/** Width over height of the area that is kept. Defaults to 1. */
	aspect?: number;
	/** `"round"` only shapes the area's outline; the image saved is still a rectangle. */
	shape?: "round" | "rect";
	/** How far in the picture is zoomed. 1 just covers the area. Pass a signal to control it. */
	zoom?: Signal<number> | number;
	onZoomChange?: ChangeHandler<number>;
	minZoom?: number;
	maxZoom?: number;
	/** The alt text of the picture. */
	alt?: string;
};

const KEYBOARD_PAN = 10;

class CropperState {
	size = signal({ width: 0, height: 0 });
	natural = signal({ width: 0, height: 0 });
	offset = signal({ x: 0, y: 0 });
	zoom: Signal<number>;
	private pointers = new Map<number, { x: number; y: number }>();
	private pinchDistance = 0;

	constructor(
		readonly root: ImageCropperState,
		readonly aspect: number,
		zoom: Signal<number> | number,
		readonly minZoom: number,
		readonly maxZoom: number,
	) {
		this.zoom = signal(zoom);
	}

	/** Where the crop area and the picture sit, or null before anything is measured. */
	layout() {
		const { width, height } = this.size.get();
		const natural = this.natural.get();
		if (width === 0 || height === 0 || natural.width === 0) return null;
		const cropWidth = width / height > this.aspect ? height * this.aspect : width;
		const cropHeight = cropWidth / this.aspect;
		// at zoom 1 the picture just covers the crop area
		const scale =
			Math.max(cropWidth / natural.width, cropHeight / natural.height) * this.zoom.get();
		const maxX = Math.max(0, (natural.width * scale - cropWidth) / 2);
		const maxY = Math.max(0, (natural.height * scale - cropHeight) / 2);
		return { cropWidth, cropHeight, scale, maxX, maxY, natural };
	}

	/** Keeps the picture over the whole crop area, and tells the root what is inside it. */
	settle(x = this.offset.get().x, y = this.offset.get().y) {
		const layout = this.layout();
		if (!layout) return;
		const next = {
			x: Math.min(layout.maxX, Math.max(-layout.maxX, x)),
			y: Math.min(layout.maxY, Math.max(-layout.maxY, y)),
		};
		const current = this.offset.get();
		if (current.x !== next.x || current.y !== next.y) this.offset.set(next);

		const { scale, cropWidth, cropHeight, natural } = layout;
		this.root.pixelCrop = {
			x: Math.max(0, natural.width / 2 + (-cropWidth / 2 - next.x) / scale),
			y: Math.max(0, natural.height / 2 + (-cropHeight / 2 - next.y) / scale),
			width: Math.min(natural.width, cropWidth / scale),
			height: Math.min(natural.height, cropHeight / scale),
		};
	}

	setZoom(value: number) {
		this.zoom.set(Math.min(this.maxZoom, Math.max(this.minZoom, value)));
		this.settle();
	}

	pan(dx: number, dy: number) {
		const { x, y } = this.offset.get();
		this.settle(x + dx, y + dy);
	}

	onPointerdown(e: PointerEvent, el: HTMLElement) {
		el.setPointerCapture?.(e.pointerId);
		this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		this.pinchDistance = this.distance();
	}

	onPointermove(e: PointerEvent) {
		const previous = this.pointers.get(e.pointerId);
		if (!previous) return;
		this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (this.pointers.size === 1) {
			this.pan(e.clientX - previous.x, e.clientY - previous.y);
		} else if (this.pointers.size === 2) {
			const distance = this.distance();
			if (this.pinchDistance > 0) this.setZoom((this.zoom.get() * distance) / this.pinchDistance);
			this.pinchDistance = distance;
		}
	}

	onPointerup(e: PointerEvent) {
		this.pointers.delete(e.pointerId);
		this.pinchDistance = this.distance();
	}

	onWheel(e: WheelEvent) {
		e.preventDefault();
		this.setZoom(this.zoom.get() * Math.exp(-e.deltaY * 0.002));
	}

	onKeydown(e: KeyboardEvent) {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [KEYBOARD_PAN, 0],
			ArrowRight: [-KEYBOARD_PAN, 0],
			ArrowUp: [0, KEYBOARD_PAN],
			ArrowDown: [0, -KEYBOARD_PAN],
		};
		const move = moves[e.key];
		if (move) this.pan(move[0], move[1]);
		else if (e.key === "+" || e.key === "=") this.setZoom(this.zoom.get() * 1.1);
		else if (e.key === "-") this.setZoom(this.zoom.get() / 1.1);
		else return;
		e.preventDefault();
	}

	private distance() {
		const [a, b] = [...this.pointers.values()];
		return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
	}
}

/**
 * The area where the picture is moved and zoomed under a fixed crop area.
 * Drag to pan, scroll or pinch to zoom; with focus, the arrow keys pan and
 * `+` and `-` zoom. It has no size of its own, so give it a width and a height.
 */
export const ImageCropperCropper = createComponent(function ImageCropperCropper(
	{
		aspect = 1,
		shape = "round",
		zoom = 1,
		onZoomChange,
		minZoom = 1,
		maxZoom = 3,
		alt = "",
		...restProps
	}: ImageCropperCropperProps,
	...children: Child[]
) {
	return ImageCropperCtx.Use((root) => {
		const state = new CropperState(root, aspect, zoom, minZoom, maxZoom);
		const container: Ref<HTMLElement> = ref<HTMLElement>();

		const picture = derived([state.size, state.natural, state.offset, state.zoom], () => {
			const layout = state.layout();
			if (!layout) return "visibility:hidden";
			const { x, y } = state.offset.get();
			return [
				"position:absolute",
				"left:50%",
				"top:50%",
				`width:${layout.natural.width}px`,
				`height:${layout.natural.height}px`,
				"max-width:none",
				"transform-origin:center",
				`transform:translate(-50%,-50%) translate(${x}px,${y}px) scale(${layout.scale})`,
				"user-select:none",
				"pointer-events:none",
			].join(";");
		});
		const area = derived([state.size, state.natural], () => {
			const layout = state.layout();
			return [
				"position:absolute",
				"left:50%",
				"top:50%",
				"transform:translate(-50%,-50%)",
				`width:${layout ? layout.cropWidth : 0}px`,
				`height:${layout ? layout.cropHeight : 0}px`,
				"pointer-events:none",
			].join(";");
		});

		const measure = () => {
			const el = container.get();
			if (!el) return;
			const { width, height } = el.getBoundingClientRect();
			const current = state.size.get();
			if (current.width !== width || current.height !== height) {
				state.size.set({ width, height });
				state.settle();
			}
		};

		return ImplementLifecycle(
			{
				onMount: () => {
					measure();
					const stops = [
						state.zoom.onChange((value) => onZoomChange?.(value)),
						root.tempUrl.onChange(() => {
							// a new picture starts centred and unzoomed
							state.natural.set({ width: 0, height: 0 });
							state.offset.set({ x: 0, y: 0 });
							state.zoom.set(Math.max(minZoom, 1));
						}),
					];
					let observer: ResizeObserver | null = null;
					const el = container.get();
					if (el && typeof ResizeObserver !== "undefined") {
						observer = new ResizeObserver(measure);
						observer.observe(el);
					}
					return () => {
						observer?.disconnect();
						for (const stop of stops) stop();
					};
				},
			},
			Div(
				mergeProps(
					{
						this: container,
						tabindex: 0,
						role: "application",
						"aria-label": "Image cropper. Arrow keys pan, plus and minus zoom.",
						"data-image-cropper-cropper": "",
						"data-shape": shape,
						style: {
							position: "relative",
							overflow: "hidden",
							touchAction: "none",
						},
						onPointerdown: (e: PointerEvent) => {
							const el = container.get();
							if (el) state.onPointerdown(e, el);
						},
						onPointermove: (e: PointerEvent) => state.onPointermove(e),
						onPointerup: (e: PointerEvent) => state.onPointerup(e),
						onPointercancel: (e: PointerEvent) => state.onPointerup(e),
						onWheel: (e: WheelEvent) => state.onWheel(e),
						onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
					},
					restProps,
				),
				Img({
					src: root.tempUrl.bind((url) => url || undefined),
					alt,
					draggable: false,
					"data-image-cropper-image": "",
					style: picture,
					onLoad: (e: Event) => {
						const img = e.currentTarget;
						if (!(img instanceof HTMLImageElement)) return;
						state.natural.set({ width: img.naturalWidth, height: img.naturalHeight });
						measure();
						state.settle(0, 0);
					},
				}),
				Div({ "data-image-cropper-area": "", "data-shape": shape, style: area }),
				...children,
			),
		);
	});
});

export type ImageCropperCropProps = ComponentProps<typeof Button>;

/** Confirms the crop: the picture becomes the root's `src` and the dialog closes. */
export const ImageCropperCrop = createComponent(function ImageCropperCrop(
	{ onClick, ...props }: ImageCropperCropProps,
	...children: Child[]
) {
	return ImageCropperCtx.Use((state) =>
		Button(
			mergeProps(
				{
					type: "button" as const,
					"data-image-cropper-crop": "",
					onClick: (e: MouseEvent) => {
						// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a handler prop is callable
						(onClick as ((e: MouseEvent) => void) | undefined)?.(e);
						void state.crop();
					},
				},
				props,
			),
			...children,
		),
	);
});

export type ImageCropperCancelProps = ComponentProps<typeof Button>;

/** Throws the picture away and closes. */
export const ImageCropperCancel = createComponent(function ImageCropperCancel(
	{ onClick, ...props }: ImageCropperCancelProps,
	...children: Child[]
) {
	return ImageCropperCtx.Use((state) =>
		Button(
			mergeProps(
				{
					type: "button" as const,
					"data-image-cropper-cancel": "",
					onClick: (e: MouseEvent) => {
						// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a handler prop is callable
						(onClick as ((e: MouseEvent) => void) | undefined)?.(e);
						state.cancel();
					},
				},
				props,
			),
			...children,
		),
	);
});

/** The state of the nearest image cropper, for parts you write yourself. */
export const ImageCropperContext = ImageCropperCtx;
