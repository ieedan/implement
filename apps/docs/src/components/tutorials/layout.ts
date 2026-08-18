import { Div, type Mountable } from "@packages/implement";
import { SiteHeader } from "../site-header";

export function TutorialsLayout(child: Mountable): Mountable {
	return Div({ class: "flex h-dvh flex-col overflow-hidden" }, SiteHeader(), child);
}
