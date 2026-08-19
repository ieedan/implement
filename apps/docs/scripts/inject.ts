/** Injects a server render into the index.html shell (dev middleware and prerender). */
export function injectSsr(template: string, result: { html: string; head: string }): string {
	let page = template;
	// the SSR title replaces the shell's static one
	if (result.head.includes("<title>")) page = page.replace(/<title>.*?<\/title>/, "");
	page = page.replace("</head>", `${result.head}\n\t</head>`);
	// display: contents keeps the wrapper layout-neutral; the client entry drops
	// it before mounting (no hydration)
	return page.replace(
		/<body([^>]*)>/,
		`<body$1><div data-ssr style="display: contents">${result.html}</div>`,
	);
}
