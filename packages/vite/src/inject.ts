export type SsrResult = { html: string; head: string };

/** Injects a server render into the index.html shell. */
export function injectSsr(template: string, result: SsrResult, stylesheets: string[] = []): string {
	let page = template;
	// the SSR title replaces the shell's static one
	if (result.head.includes("<title>")) page = page.replace(/<title>.*?<\/title>/, "");
	const links = stylesheets
		.map((href) => `<link rel="stylesheet" href="${href}" />`)
		.join("\n\t\t");
	const head = links === "" ? result.head : `${result.head}\n\t\t${links}`;
	page = page.replace("</head>", `${head}\n\t</head>`);
	// display: contents keeps the wrapper layout-neutral; App.render swaps it
	// out for the client mount (no hydration)
	return page.replace(
		/<body([^>]*)>/,
		`<body$1><div data-ssr style="display: contents">${result.html}</div>`,
	);
}
