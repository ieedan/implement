/**
 * The social meta tags a page puts in its head.
 *
 * Split from `./og-image.server.ts` on purpose: the tags are rendered by the
 * views, which are client code, and the image renderer pulls in satori and a
 * rasterizer. The two halves of a page's Open Graph story cannot share a
 * module without the second one following the first into the browser bundle.
 */

import { ImplementHead, type HeadChild } from "@implementjs/core";
import { absolute } from "./site";

/** The size every social platform crops against, and what the tags advertise. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** The image a page falls back to when it has no generated twin of its own. */
export const DEFAULT_OG_IMAGE = "/og.png";

export type OgTagsOptions = {
	title: string;
	description: string;
	/** Site-root-relative path of the page itself. */
	url: string;
	/** Site-root-relative path of its image. Defaults to {@link DEFAULT_OG_IMAGE}. */
	image?: string;
};

/**
 * Open Graph and Twitter both, because Twitter reads `og:*` for everything
 * except which card shape to draw.
 */
export function ogTags({
	title,
	description,
	url,
	image = DEFAULT_OG_IMAGE,
}: OgTagsOptions): HeadChild[] {
	return [
		ImplementHead.Meta({ property: "og:type", content: "website" }),
		ImplementHead.Meta({ property: "og:site_name", content: "implement" }),
		ImplementHead.Meta({ property: "og:title", content: title }),
		ImplementHead.Meta({ property: "og:description", content: description }),
		ImplementHead.Meta({ property: "og:url", content: absolute(url) }),
		ImplementHead.Meta({ property: "og:image", content: absolute(image) }),
		ImplementHead.Meta({ property: "og:image:width", content: String(OG_WIDTH) }),
		ImplementHead.Meta({ property: "og:image:height", content: String(OG_HEIGHT) }),
		ImplementHead.Meta({ property: "og:image:alt", content: title }),
		ImplementHead.Meta({ name: "twitter:card", content: "summary_large_image" }),
	];
}
