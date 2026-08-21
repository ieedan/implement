export {
	addCreateCommand,
	type CreateCommandResult,
	type CreateOptions,
	DEFAULT_ADDONS,
	DEFAULT_DIRECTORY,
	DEFAULT_TEMPLATE,
	runCreate,
	schema as createOptionsSchema,
} from "@/commands/create";
export { getTemplate, templates } from "@/templates";
export {
	ADDON_META,
	ADDONS,
	type Addon,
	type Template,
	type TemplateContext,
	type TemplateFile,
	type TemplateId,
	TEMPLATES,
} from "@/templates/types";
export { PACKAGE_MANAGERS, type PackageManager } from "@/utils/package";
