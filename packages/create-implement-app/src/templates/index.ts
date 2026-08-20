import { csr } from "@/templates/csr";
import { kit } from "@/templates/kit";
import type { Template, TemplateId } from "@/templates/types";

export const templates = {
	kit,
	csr,
} as const satisfies Record<TemplateId, Template>;

export function getTemplate(id: TemplateId): Template {
	return templates[id];
}

export { csr, kit };
export * from "@/templates/types";
