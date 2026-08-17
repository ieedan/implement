import { App } from "@packages/implement";
import { router } from "./router";
import "../app.css";

const app = App({ target: document.getElementById("root")! });

app.render(router);
