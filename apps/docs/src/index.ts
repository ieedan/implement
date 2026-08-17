import { App } from "@packages/implement";
import { router } from "./router";

const app = App({ target: document.getElementById("root")! });

app.render(router);
