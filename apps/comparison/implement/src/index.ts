import { App } from "@implementjs/core";
import { IssueApp } from "./app";
import "./app.css";

const app = App({ target: document.getElementById("root")! });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

app.render(IssueApp());

// Read by the benchmark driver as "time to interactive app".
performance.mark("app-mounted");
