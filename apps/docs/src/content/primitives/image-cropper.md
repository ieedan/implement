---
title: Image Cropper
description: Choose an image, then move and zoom it under a fixed crop area.
section: Components
---

<div data-demo="image-cropper"></div>

An image cropper takes a file, lets you pan and zoom it under a fixed crop area, and hands back the part inside as a new image. The root keeps the state and one hidden file input; a trigger is a label pointing at it, so anything can open the file picker. The picture is cropped to a PNG and returned as an object URL, which the root writes to `src`.

```ts
import {
	ImageCropper,
	ImageCropperCancel,
	ImageCropperCrop,
	ImageCropperCropper,
	ImageCropperTrigger,
} from "@implementjs/primitives";

const src = signal("");

ImageCropper(
	{ src },
	ImageCropperTrigger("Choose a picture"),
	// put the cropper wherever it should show — a dialog, a page — when `open` is true
	Div(
		ImageCropperCropper({ aspect: 1, style: { width: "300px", height: "300px" } }),
		ImageCropperCrop("Crop"),
		ImageCropperCancel("Cancel"),
	),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component).

## Open state

There is no dialog in the primitive: it keeps an `open` signal and sets it when a file is chosen, and you show the cropper however you like. Pass a signal to read it or to close the cropper from outside. `ImageCropperContext.Use` hands you the whole state — `open`, `src`, and `tempUrl`, the picture being cropped — which is how the [styled version](/ui/image-cropper) binds a dialog to it:

```ts
ImageCropperContext.Use((state) => Dialog({ open: state.open } /* cropper and buttons */));
```

## Moving and zooming

The picture starts covering the crop area, so the saved image never has empty edges. Drag to pan, scroll or pinch to zoom; with focus on the surface, the arrow keys pan and `+` and `-` zoom. `zoom` takes a number or a [signal](/docs/signals) — bind it to a slider — between `minZoom` and `maxZoom`.

`aspect` is width over height of the area that is kept. `shape` sets `data-shape` to `"round"` or `"rect"` for styling the outline; the saved image is always a rectangle, so round it with CSS wherever you show it.

The surface has no size of its own, so give it a width and a height. Style the dimmed surround through the crop area, `[data-image-cropper-area]`, which sits over the picture and is sized to the kept region.

## Files

Only images a browser can draw are accepted (`VALID_IMAGE_TYPES`); anything else calls `onUnsupportedFile` and nothing opens. The same file can be chosen twice in a row. Every object URL created is revoked when the root unmounts, so copy the picture out — `getFileFromUrl(url)` turns it into a `File` for uploading — before then.

## API Reference

<div data-api="image-cropper"></div>
