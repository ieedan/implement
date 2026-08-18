import { App } from "@packages/implement";
import { disposeRoots } from "@packages/implement/hmr";
import { router } from "./router";
import "../app.css";

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(disposeRoots);
}

const app = App({ target: document.getElementById("root")! });

app.render(router);
