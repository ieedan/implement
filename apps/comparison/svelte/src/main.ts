import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";

mount(App, { target: document.getElementById("root")! });

// Read by the benchmark driver as "time to interactive app".
performance.mark("app-mounted");
