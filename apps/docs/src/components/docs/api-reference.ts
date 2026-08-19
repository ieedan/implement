import {
	Code,
	Div,
	H3,
	P,
	Span,
	Table,
	Tbody,
	Td,
	Th,
	Thead,
	Tr,
	type Child,
	type Mountable,
} from "@implementjs/core";
import {
	apiPartId,
	type ApiDataAttribute,
	type ApiPart,
	type ApiProp,
} from "../../lib/api-reference";

const cellClass = "px-4 py-2.5 align-top";
const headClass = "px-4 py-2 text-left text-xs font-medium text-foreground/60";

function Chip(text: string): Mountable {
	return Code(
		{ class: "rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap" },
		text,
	);
}

function TypeText(text: string): Mountable {
	return Code({ class: "font-mono text-xs text-foreground/70" }, text);
}

function ApiTable(head: string[], rows: Child[][]): Mountable {
	return Div(
		{ class: "overflow-x-auto rounded-lg border border-border" },
		Table(
			{ class: "w-full min-w-md text-sm" },
			Thead(
				Tr(
					{ class: "border-b border-border bg-foreground/[0.03]" },
					...head.map((label) => Th({ class: headClass }, label)),
				),
			),
			Tbody(
				...rows.map((cells, index) =>
					Tr(
						{ class: index > 0 ? "border-t border-border" : "" },
						...cells.map((cell) => Td({ class: cellClass }, cell)),
					),
				),
			),
		),
	);
}

function PropsTable(props: ApiProp[]): Mountable {
	return ApiTable(
		["Prop", "Type", "Default", "Description"],
		props.map((prop) => [
			Span(
				{ class: "inline-flex items-center gap-1" },
				Chip(prop.name),
				prop.required ? Span({ class: "text-destructive", title: "Required" }, "*") : Span(""),
			),
			TypeText(prop.type),
			prop.default != null ? TypeText(prop.default) : Span({ class: "text-foreground/40" }, "—"),
			Span({ class: "text-foreground/60" }, prop.description),
		]),
	);
}

function DataAttributesTable(attributes: ApiDataAttribute[]): Mountable {
	return ApiTable(
		["Data attribute", "Value"],
		attributes.map((attribute) => [
			Chip(`[${attribute.name}]`),
			attribute.value === "Present"
				? Span({ class: "text-foreground/60" }, "Present")
				: TypeText(attribute.value),
		]),
	);
}

function PartSection(part: ApiPart): Mountable {
	return Div(
		{ class: "space-y-3" },
		Div(
			{ class: "space-y-1" },
			H3({ id: apiPartId(part.name), class: "font-semibold" }, part.name),
			P(
				{ class: "text-sm text-foreground/60" },
				part.description ? `${part.description} ` : "",
				"Renders a ",
				Chip(part.element),
				"; extra props are forwarded onto it.",
			),
		),
		...(part.props?.length ? [PropsTable(part.props)] : []),
		...(part.dataAttributes?.length ? [DataAttributesTable(part.dataAttributes)] : []),
	);
}

/** The API reference tables for every part of one primitive. */
export function ApiReference(parts: ApiPart[]): Mountable {
	return Div({ class: "space-y-8" }, ...parts.map((part) => PartSection(part)));
}
