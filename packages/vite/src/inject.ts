import { devStyleTags, type DevStyle } from "./styles.ts";

export type SsrResult = {
	html: string;
	head: string;
	/** Serializable route data to embed in the page for the client to pick up. */
	data?: unknown;
};

/** `</script>` (and any `<`) in embedded JSON must not terminate the script tag. */
function serializeData(data: unknown): string {
	return JSON.stringify(data).replaceAll("<", "\\u003c");
}

/** Injects a server render into the index.html shell. */
export function injectSsr(template: string, result: SsrResult, styles: DevStyle[] = []): string {
	let page = template;
	// the SSR title replaces the shell's static one
	if (result.head.includes("<title>")) page = page.replace(/<title>.*?<\/title>/, "");
	const tags = devStyleTags(styles);
	const head = tags === "" ? result.head : `${result.head}\n\t\t${tags}`;
	page = page.replace("</head>", `${head}\n\t</head>`);
	const dataTag =
		result.data === undefined
			? ""
			: `<script type="application/json" data-implement-data>${serializeData(result.data)}</script>`;
	// display: contents keeps the wrapper layout-neutral; App.render swaps it
	// out for the client mount (no hydration)
	return page.replace(
		/<body([^>]*)>/,
		`<body$1><div data-ssr style="display: contents">${result.html}</div>${dataTag}`,
	);
}
