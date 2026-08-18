import { App } from "@implementjs/core";
import { router } from "./router";
import "../app.css";

const app = App({ target: document.getElementById("root")! });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

app.render(router);
