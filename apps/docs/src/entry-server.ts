import { renderToString, type RenderToStringResult } from "@implementjs/core/server";
import { router } from "./router";

export function render(url: string): RenderToStringResult {
	return renderToString(router, { location: url });
}
