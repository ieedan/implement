---
title: Image Cropper
description: Upload an image, then crop it in a dialog.
section: Components
---

<div data-demo="image-cropper" data-demo-description="An avatar that opens a crop dialog when it is clicked and a file is chosen. Drag to move, scroll to zoom."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/image-cropper
```

It installs `@implementjs/lucide` at the same time, plus the [avatar](/ui/avatar), [button](/ui/button), and [dialog](/ui/dialog) components it is built from.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/image-cropper.ts`, along with [`avatar.ts`](/ui/avatar), [`button.ts`](/ui/button), and [`dialog.ts`](/ui/dialog) (and what they need). It imports [`cn`](/ui#merging-classes) from `@implementjs/cn`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="image-cropper"></div>

<div data-tabs-end></div>

## Usage

```ts
import { signal } from "@implementjs/core";
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

const src = signal("");

ImageCropper(
	{ src, onCropped: (url) => upload(url) },
	ImageCropperTrigger(ImageCropperPreview()),
	ImageCropperDialog(
		ImageCropperCropper(),
		ImageCropperControls(ImageCropperCrop(), ImageCropperCancel()),
	),
);
```

The composition:

```text
ImageCropper
├── ImageCropperTrigger
│   └── ImageCropperPreview
└── ImageCropperDialog
    ├── ImageCropperCropper
    └── ImageCropperControls
        ├── ImageCropperCrop
        └── ImageCropperCancel
```

`src` is an object URL; to send it to a server, turn it into a file with `getFileFromUrl(src)`.

## Custom preview

Pass `child` to `ImageCropperPreview` to draw the picture yourself, and `aspect` and `shape` to the cropper to match:

<div data-demo="image-cropper-wide" data-demo-description="A 16:9 cover image with a rectangular crop area and a custom preview."></div>

## API Reference

Every prop the styling does not consume is forwarded to the [Image Cropper primitive](/primitives/docs/image-cropper), so the tables below are the whole surface.

<div data-api="ui-image-cropper"></div>
