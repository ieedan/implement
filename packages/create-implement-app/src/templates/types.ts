import type { PackageManager } from "@/utils/package";

/** The starting points a new app can be created from. */
export const TEMPLATES = ["kit", "csr"] as const;

export type TemplateId = (typeof TEMPLATES)[number];

/** The optional extras that can be layered onto either template. */
export const ADDONS = ["tailwind", "primitives", "ui", "icons", "forms", "modeWatcher"] as const;

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
	ui: {
		label: "@implementjs/ui",
		hint: "Styled components, copied in with jsrepo",
	},
	icons: {
		label: "@implementjs/lucide",
		hint: "Lucide icons as implement components",
	},
	forms: {
		label: "@implementjs/formish",
		hint: "Schema-first forms, validated with valibot",
	},
	modeWatcher: {
		label: "@implementjs/mode-watcher",
		hint: "Dark mode, applied before the first paint",
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
	/**
	 * Specifiers for the implement packages, keyed by package name — how `--link` points an app at a
	 * local clone of the implement repo (`link:../implement/packages/core`). Anything not in here
	 * falls back to a version.
	 */
	link?: Record<string, string>;
	/**
	 * How the app should spell the path to the local clone `--link` points at — the same relative
	 * path the linked specifiers use. The `ui` addon turns it into the `fs://` registry its
	 * `jsrepo.config.ts` reads, so components come off disk instead of over the network.
	 */
	linkRoot?: string;
	/**
	 * The package manager the app will be installed with. Only pnpm needs anything written for it —
	 * see {@link pnpmWorkspace}.
	 */
	packageManager?: PackageManager;
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
