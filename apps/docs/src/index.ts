import { App } from "@implementjs/core";
import { router } from "./router";
import "../app.css";

const app = App({ target: document.getElementById("root")! });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

// no hydration yet: swap the prerendered markup for a fresh mount in one task,
// restoring scroll because removing the old tree collapses the page height
const ssr = document.querySelector("[data-ssr]");
const { scrollX, scrollY } = window;
ssr?.remove();

app.render(router);

if (ssr) window.scrollTo(scrollX, scrollY);
