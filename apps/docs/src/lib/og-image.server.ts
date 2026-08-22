/**
 * The site's Open Graph images.
 *
 * One card design, rendered by `@implementjs/kit/og` from ordinary implement
 * components and served by the `.png` extension routes next to each section's
 * `.md` ones. Every docs page therefore has an image twin at
 * `<permalink>.png`, derived at build time from the page it belongs to — the
 * prerenderer walks the same routes for both.
 *
 * Server-only by its name, which is what keeps satori and the rasterizer out
 * of the browser bundle; the head tags that point at these images are in
 * `./og-tags.ts`, which the views import instead.
 *
 * Everything here renders through satori, which lays out a flexbox subset and
 * has never seen the site's stylesheet: style with `style`, give any element
 * with several children an explicit `display: "flex"`, and expect none of the
 * app's Tailwind classes to apply.
 */

import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff?inline";
import interSemiBold from "@fontsource/inter/files/inter-latin-600-normal.woff?inline";
import type { Mountable } from "@implementjs/core";
import { Div, ImageResponse, Span, type OgFont } from "@implementjs/kit/og";
import { OG_HEIGHT, OG_WIDTH } from "./og-tags";
import { SITE_ORIGIN } from "./site";
import { Logo } from "@/lib/components/logo";

/** The dark palette from `app.css`, which is what the mark was drawn for. */
const BACKGROUND = "#000";
const FOREGROUND = "#fff";
const MUTED = "#a1a1a1";
const BORDER = "#222";

const HOST = new URL(SITE_ORIGIN).host;

/**
 * The font files as bytes.
 *
 * Satori has no system fonts, so the file itself has to be handed over.
 * `?inline` is what makes that portable: Vite hands back a data url, which
 * `fetch` reads on any host, where the `new URL(…, import.meta.url)` form from
 * vercel's docs would need a file server the build does not have.
 *
 * Started once at module scope and awaited per image, so the decode is paid
 * for by the first one and shared by every other.
 */
const fonts: Promise<OgFont[]> = Promise.all([
	fetch(interRegular).then((response) => response.arrayBuffer()),
	fetch(interSemiBold).then((response) => response.arrayBuffer()),
]).then(([regular, semiBold]) => [
	{ name: "Inter", data: regular, weight: 400, style: "normal" },
	{ name: "Inter", data: semiBold, weight: 600, style: "normal" },
]);

export type OgCardContent = {
	title: string;
	description: string;
	/** The section name beside the wordmark — the collection a docs page belongs to. */
	label?: string;
	/** The url along the bottom, without its scheme. Defaults to the bare host. */
	path?: string;
};

function Card({ title, description, label, path }: OgCardContent): Mountable {
	return Div(
		{
			style: {
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				width: "100%",
				height: "100%",
				padding: 72,
				background: BACKGROUND,
				color: FOREGROUND,
				fontFamily: "Inter",
			},
		},
		Div(
			{ style: { display: "flex", alignItems: "center", gap: 20 } },
			// the mark is drawn taller than it is wide, so it is sized by height
			Logo({ height: 56, width: 33, style: { color: FOREGROUND } }),
			Span({ style: { fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" } }, "implement"),
			...(label === undefined
				? []
				: [
						Span({ style: { fontSize: 30, color: BORDER } }, "/"),
						Span({ style: { fontSize: 30, color: MUTED } }, label),
					]),
		),
		Div(
			{ style: { display: "flex", flexDirection: "column", gap: 20 } },
			Span(
				{
					style: {
						fontSize: 68,
						fontWeight: 600,
						lineHeight: 1.1,
						letterSpacing: "-0.03em",
						// a title long enough to need a third line would push the
						// footer off the card
						lineClamp: 2,
					},
				},
				title,
			),
			Span({ style: { fontSize: 30, color: MUTED, lineHeight: 1.4, lineClamp: 2 } }, description),
		),
		Div(
			{
				style: {
					display: "flex",
					borderTop: `1px solid ${BORDER}`,
					paddingTop: 28,
					fontSize: 24,
					color: MUTED,
				},
			},
			path === undefined ? HOST : `${HOST}${path}`,
		),
	);
}

/** The rendered card, as the `.png` routes return it. */
export async function ogImageResponse(content: OgCardContent): Promise<Response> {
	return new ImageResponse(Card(content), {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts: await fonts,
	});
}

type OgPage = { title: string; description: string; slug: string; permalink: string };

/**
 * A docs page's card: its own title and description, under its collection's
 * name. `slug` is the route param, so `""` is the collection's index page —
 * the same lookup `markdownResponse` does for the `.md` twin.
 */
export async function pageOgImageResponse(
	collection: readonly OgPage[],
	label: string,
	slug: string,
): Promise<Response> {
	const page = collection.find((entry) => entry.slug === slug);
	if (page === undefined) return new Response("Not found", { status: 404 });
	return await ogImageResponse({
		title: page.title,
		description: page.description,
		label,
		path: page.permalink,
	});
}
