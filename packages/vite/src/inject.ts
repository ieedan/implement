import { devStyleTags, type DevStyle } from "./styles.ts";

export type SsrResult = { html: string; head: string };

/** Injects a server render into the index.html shell. */
export function injectSsr(template: string, result: SsrResult, styles: DevStyle[] = []): string {
	let page = template;
	// the SSR title replaces the shell's static one
	if (result.head.includes("<title>")) page = page.replace(/<title>.*?<\/title>/, "");
	const tags = devStyleTags(styles);
	const head = tags === "" ? result.head : `${result.head}\n\t\t${tags}`;
	page = page.replace("</head>", `${head}\n\t</head>`);
	// display: contents keeps the wrapper layout-neutral; App.render swaps it
	// out for the client mount (no hydration)
	return page.replace(
		/<body([^>]*)>/,
		`<body$1><div data-ssr style="display: contents">${result.html}</div>`,
	);
}
