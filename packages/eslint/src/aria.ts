/**
 * The WAI-ARIA 1.2 attribute and role tables, vendored.
 *
 * `aria-query` is the usual source for this data, but it would be the only
 * runtime dependency in the package and the tables it exposes are keyed for
 * JSX. ARIA 1.2 has been a W3C Recommendation since 2023 and 1.3 is still a
 * draft, so the churn this saves us from is close to zero — and both rules
 * take an option for the attributes and roles a project adds on top.
 *
 * @see https://www.w3.org/TR/wai-aria-1.2/#state_prop_def
 * @see https://www.w3.org/TR/wai-aria-1.2/#role_definitions
 */

/** How an attribute's value is validated. `string` and `id` accept anything. */
export type AriaValueType =
	| "boolean"
	| "id"
	| "idlist"
	| "integer"
	| "number"
	| "string"
	| "token"
	| "tokenlist"
	| "tristate";

export type AriaAttribute = {
	type: AriaValueType;
	/** Permitted values for `token`/`tokenlist`. */
	values?: readonly string[];
};

/**
 * `undefined` is a permitted value for several ARIA states, but in this
 * framework omitting the prop (or letting a readable yield `undefined`) is how
 * you express it — so it is not listed as a literal token anywhere below.
 */
export const ARIA_ATTRIBUTES: Readonly<Record<string, AriaAttribute>> = {
	"aria-activedescendant": { type: "id" },
	"aria-atomic": { type: "boolean" },
	"aria-autocomplete": { type: "token", values: ["inline", "list", "both", "none"] },
	"aria-braillelabel": { type: "string" },
	"aria-brailleroledescription": { type: "string" },
	"aria-busy": { type: "boolean" },
	"aria-checked": { type: "tristate" },
	"aria-colcount": { type: "integer" },
	"aria-colindex": { type: "integer" },
	"aria-colindextext": { type: "string" },
	"aria-colspan": { type: "integer" },
	"aria-controls": { type: "idlist" },
	"aria-current": {
		type: "token",
		values: ["page", "step", "location", "date", "time", "true", "false"],
	},
	"aria-describedby": { type: "idlist" },
	"aria-description": { type: "string" },
	"aria-details": { type: "id" },
	"aria-disabled": { type: "boolean" },
	"aria-errormessage": { type: "id" },
	"aria-expanded": { type: "boolean" },
	"aria-flowto": { type: "idlist" },
	"aria-haspopup": {
		type: "token",
		values: ["false", "true", "menu", "listbox", "tree", "grid", "dialog"],
	},
	"aria-hidden": { type: "boolean" },
	"aria-invalid": { type: "token", values: ["grammar", "false", "spelling", "true"] },
	"aria-keyshortcuts": { type: "string" },
	"aria-label": { type: "string" },
	"aria-labelledby": { type: "idlist" },
	"aria-level": { type: "integer" },
	"aria-live": { type: "token", values: ["assertive", "off", "polite"] },
	"aria-modal": { type: "boolean" },
	"aria-multiline": { type: "boolean" },
	"aria-multiselectable": { type: "boolean" },
	"aria-orientation": { type: "token", values: ["horizontal", "vertical"] },
	"aria-owns": { type: "idlist" },
	"aria-placeholder": { type: "string" },
	"aria-posinset": { type: "integer" },
	"aria-pressed": { type: "tristate" },
	"aria-readonly": { type: "boolean" },
	"aria-relevant": {
		type: "tokenlist",
		values: ["additions", "all", "removals", "text"],
	},
	"aria-required": { type: "boolean" },
	"aria-roledescription": { type: "string" },
	"aria-rowcount": { type: "integer" },
	"aria-rowindex": { type: "integer" },
	"aria-rowindextext": { type: "string" },
	"aria-rowspan": { type: "integer" },
	"aria-selected": { type: "boolean" },
	"aria-setsize": { type: "integer" },
	"aria-sort": { type: "token", values: ["ascending", "descending", "none", "other"] },
	"aria-valuemax": { type: "number" },
	"aria-valuemin": { type: "number" },
	"aria-valuenow": { type: "number" },
	"aria-valuetext": { type: "string" },
};

/**
 * Removed in ARIA 1.2 but still widely typed and copied from older examples,
 * so they get a message that says what to use instead of "unknown attribute".
 */
export const DEPRECATED_ARIA_ATTRIBUTES: Readonly<Record<string, string>> = {
	"aria-dropeffect": "It was deprecated in ARIA 1.1 and does nothing in any browser.",
	"aria-grabbed": "It was deprecated in ARIA 1.1 and does nothing in any browser.",
};

/** Concrete roles an author may put on an element. */
export const ARIA_ROLES: ReadonlySet<string> = new Set([
	"alert",
	"alertdialog",
	"application",
	"article",
	"banner",
	"blockquote",
	"button",
	"caption",
	"cell",
	"checkbox",
	"code",
	"columnheader",
	"combobox",
	"complementary",
	"contentinfo",
	"definition",
	"deletion",
	"dialog",
	"document",
	"emphasis",
	"feed",
	"figure",
	"form",
	"generic",
	"grid",
	"gridcell",
	"group",
	"heading",
	"img",
	"insertion",
	"link",
	"list",
	"listbox",
	"listitem",
	"log",
	"main",
	"marquee",
	"math",
	"menu",
	"menubar",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"meter",
	"navigation",
	"none",
	"note",
	"option",
	"paragraph",
	"presentation",
	"progressbar",
	"radio",
	"radiogroup",
	"region",
	"row",
	"rowgroup",
	"rowheader",
	"scrollbar",
	"search",
	"searchbox",
	"separator",
	"slider",
	"spinbutton",
	"status",
	"strong",
	"subscript",
	"superscript",
	"switch",
	"tab",
	"table",
	"tablist",
	"tabpanel",
	"term",
	"textbox",
	"time",
	"timer",
	"toolbar",
	"tooltip",
	"tree",
	"treegrid",
	"treeitem",
]);

/**
 * Roles that exist only to organise the taxonomy. The spec forbids authors
 * from using them, and a browser ignores them, so they are worth their own
 * message — they read like plausible roles otherwise.
 */
export const ABSTRACT_ARIA_ROLES: ReadonlySet<string> = new Set([
	"command",
	"composite",
	"input",
	"landmark",
	"range",
	"roletype",
	"section",
	"sectionhead",
	"select",
	"structure",
	"widget",
	"window",
]);

/** Removed in ARIA 1.2, with the replacement to point at. */
export const DEPRECATED_ARIA_ROLES: Readonly<Record<string, string>> = {
	directory: 'Use "list" instead.',
};
