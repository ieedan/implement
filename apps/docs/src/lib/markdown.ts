import { raws } from "../../.velite";
import { apiReference, type ApiPart } from "./api-reference";
import { demoSources } from "./components/demos/sources";

/**
 * Plain-markdown rendering for the `.md` server routes: the same source
 * markdown the site renders, with the placeholder divs resolved — demos
 * become their source code, API references become markdown tables — so the
 * output stands alone in a plain-text reader or an LLM context window.
 */

const placeholderPattern = /<div data-(demo|api)="([^"]+)"([^>]*)><\/div>/g;

/** Table cells cannot hold raw pipes (`"single" | "multiple"`). */
function cell(value: string): string {
	return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function apiPartMarkdown(part: ApiPart): string {
	const sections: string[] = [`### ${part.name}`];
	if (part.description) sections.push(part.description);
	if (part.props && part.props.length > 0) {
		sections.push(
			[
				"| Prop | Type | Default | Description |",
				"| --- | --- | --- | --- |",
				...part.props.map(
					(prop) =>
						`| \`${cell(prop.name)}\` | \`${cell(prop.type)}\` | ${prop.default ? `\`${cell(prop.default)}\`` : prop.required ? "required" : "—"} | ${cell(prop.description)} |`,
				),
			].join("\n"),
		);
	}
	if (part.dataAttributes && part.dataAttributes.length > 0) {
		sections.push(
			[
				"| Data attribute | Value |",
				"| --- | --- |",
				...part.dataAttributes.map(
					(attribute) => `| \`${cell(attribute.name)}\` | ${cell(attribute.value)} |`,
				),
			].join("\n"),
		);
	}
	if (part.cssVariables && part.cssVariables.length > 0) {
		sections.push(
			[
				"| CSS variable | Description |",
				"| --- | --- |",
				...part.cssVariables.map(
					(variable) => `| \`${cell(variable.name)}\` | ${cell(variable.description)} |`,
				),
			].join("\n"),
		);
	}
	return sections.join("\n\n");
}

/**
 * Swaps `<div data-demo>` for the demo's source and `<div data-api>` for its
 * tables. A `data-demo-description` attribute becomes a blockquote above the
 * code, describing what the demo renders — the markdown reader can't see it.
 */
function resolvePlaceholders(markdown: string): string {
	return markdown.replace(
		placeholderPattern,
		(placeholder, kind: string, name: string, rest: string) => {
			if (kind === "demo") {
				const source = demoSources[name];
				if (source == null) return placeholder;
				const description = /data-demo-description="([^"]*)"/.exec(rest)?.[1];
				const code = `\`\`\`ts\n${source.trimEnd()}\n\`\`\``;
				return description ? `> **Demo:** ${description}\n\n${code}` : code;
			}
			const parts = apiReference[name];
			return parts == null ? placeholder : parts.map(apiPartMarkdown).join("\n\n");
		},
	);
}

type MarkdownPage = { title: string; description: string; slug: string };

/**
 * The plain-markdown response for a docs page: the collection's page matching
 * `slug`, headed with its title and description. `folder` is the content
 * subdirectory the collection reads from (`""` for the root docs pages).
 */
export function markdownResponse(
	collection: readonly MarkdownPage[],
	folder: string,
	slug: string,
): Response {
	const page = collection.find((entry) => entry.slug === slug);
	const prefix = folder === "" ? "" : `${folder}/`;
	const path = slug === "" ? `${prefix}index` : `${prefix}${slug}`;
	const raw = raws.find((entry) => entry.path === path);
	if (page == null || raw == null) {
		return new Response("Not found", { status: 404 });
	}
	const body = `# ${page.title}\n\n> ${page.description}\n\n${resolvePlaceholders(raw.raw)}`;
	return new Response(body, {
		headers: { "content-type": "text/markdown; charset=utf-8" },
	});
}
