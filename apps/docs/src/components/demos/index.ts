import accordionDemo from "./accordion-demo.ts?raw";
import avatarDemo from "./avatar-demo.ts?raw";
import separatorDemo from "./separator-demo.ts?raw";

/**
 * Demo source code, keyed by the `data-demo` attribute a docs page uses to
 * place them: `<div data-demo="avatar"></div>` in the markdown mounts an
 * editable demo running `demos.avatar` at that spot.
 *
 * Each source file is a real module (type-checked like any other) whose
 * default export returns the demo UI; the docs page compiles and runs the
 * text in the browser, so the reader can edit it live.
 */
export const demos: Record<string, string> = {
	accordion: accordionDemo,
	avatar: avatarDemo,
	separator: separatorDemo,
};
