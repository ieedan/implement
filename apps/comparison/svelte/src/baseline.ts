import { mount } from "svelte";
import Baseline from "./Baseline.svelte";

mount(Baseline, { target: document.getElementById("root")! });

performance.mark("app-mounted");
