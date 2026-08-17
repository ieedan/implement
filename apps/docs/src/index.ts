import { App } from "@packages/implement";
import { router } from "./router";
import "../app.css";

const app = App({ target: document.getElementById("root")! });

const unmount = app.render(router);

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(() => unmount());
}
