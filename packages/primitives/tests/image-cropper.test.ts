// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App, Div, signal, type Child } from "@implementjs/core";
import {
	ImageCropper,
	ImageCropperCancel,
	ImageCropperContext,
	ImageCropperCropper,
	ImageCropperState,
	ImageCropperTrigger,
} from "../src/index";

function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const unmount = App({ target }).render(tree);
	await tick();
	return {
		target,
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

describe("image-cropper", () => {
	it("points the trigger at the file input", async () => {
		const { target, unmount } = await mount(
			ImageCropper({ id: "pic" }, ImageCropperTrigger("Upload")),
		);
		expect(target.querySelector("label")?.getAttribute("for")).toBe("pic");
		expect(target.querySelector("input#pic")?.getAttribute("type")).toBe("file");
		unmount();
	});

	it("refuses files that are not images", async () => {
		const onUnsupportedFile = vi.fn();
		const open = signal(false);
		let state: ImageCropperState | undefined;
		const { unmount } = await mount(
			ImageCropper(
				{ open, onUnsupportedFile },
				ImageCropperContext.Use((s) => {
					state = s;
					return null;
				}),
			),
		);
		const file = new File(["x"], "a.txt", { type: "text/plain" });
		state!.onUpload(file);
		expect(onUnsupportedFile).toHaveBeenCalledWith(file);
		expect(open.get()).toBe(false);
		unmount();
	});

	it("measures the crop area from the picture and the container", async () => {
		let state: ImageCropperState | undefined;
		const { target, unmount } = await mount(
			ImageCropper(
				{},
				ImageCropperContext.Use((s) => {
					state = s;
					return Div(
						{ style: { width: "200px", height: "200px" } },
						ImageCropperCropper({ aspect: 1 }),
					);
				}),
			),
		);
		const cropper = target.querySelector<HTMLElement>("[data-image-cropper-cropper]")!;
		cropper.getBoundingClientRect = () => ({ width: 200, height: 200 }) as DOMRect;
		window.dispatchEvent(new Event("resize"));
		state!.tempUrl.set("blob:test");
		await tick();
		const img = target.querySelector<HTMLImageElement>("img")!;
		Object.defineProperty(img, "naturalWidth", { value: 400 });
		Object.defineProperty(img, "naturalHeight", { value: 200 });
		img.dispatchEvent(new Event("load"));
		await tick();

		// no ResizeObserver in happy-dom may have run; the load measures too
		expect(state!.pixelCrop).toEqual({ x: 100, y: 0, width: 200, height: 200 });

		// the right arrow moves the view right
		cropper.dispatchEvent(
			Object.assign(new Event("keydown", { bubbles: true }), { key: "ArrowRight" }),
		);
		await tick();
		expect(state!.pixelCrop!.x).toBeGreaterThan(100);
		unmount();
	});

	it("cancel clears the picture and closes", async () => {
		const open = signal(true);
		let state: ImageCropperState | undefined;
		const { target, unmount } = await mount(
			ImageCropper(
				{ open },
				ImageCropperContext.Use((s) => {
					state = s;
					return ImageCropperCancel("Cancel");
				}),
			),
		);
		state!.tempUrl.set("blob:x");
		target.querySelector("button")!.click();
		expect(open.get()).toBe(false);
		expect(state!.tempUrl.get()).toBe("");
		unmount();
	});
});
