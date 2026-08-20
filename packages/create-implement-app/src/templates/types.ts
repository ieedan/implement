/** The starting points a new app can be created from. */
export const TEMPLATES = ["kit", "csr"] as const;

export type TemplateId = (typeof TEMPLATES)[number];

/** The optional extras that can be layered onto either template. */
export const ADDONS = ["tailwind", "primitives", "icons"] as const;

export type Addon = (typeof ADDONS)[number];

export const ADDON_META = {
	tailwind: {
		label: "tailwindcss",
		hint: "Utility classes through @tailwindcss/vite",
	},
	primitives: {
		label: "@implementjs/primitives",
		hint: "Headless, accessible components",
	},
	icons: {
		label: "@implementjs/lucide",
		hint: "Lucide icons as implement components",
	},
} as const satisfies Record<Addon, { label: string; hint: string }>;

export type TemplateContext = {
	/** The name written into the generated `package.json`. */
	name: string;
	/** The addons the app was created with. */
	addons: Addon[];
	/**
	 * Depend on the implement packages with `workspace:*` instead of a version — for scaffolding an
	 * app inside the implement monorepo itself.
	 */
	workspace: boolean;
};

export type TemplateFile = {
	/** Path relative to the app directory. */
	path: string;
	contents: string;
};

export type Template = {
	id: TemplateId;
	label: string;
	hint: string;
	/** Every file the template writes, in the order they are written. */
	files: (ctx: TemplateContext) => TemplateFile[];
};

export function hasAddon(ctx: TemplateContext, addon: Addon): boolean {
	return ctx.addons.includes(addon);
}
