import { Div, P, Input, Button, Form } from "./lib/components";
import { ForEach, Fragment } from "./lib/helper-components";
import { Derived, Signal, watch } from "./lib/signal";

const root = document.getElementById("root")!;

const search = new Signal("");
const items = new Signal<{ title: string, timestamp: number }[]>([{ title: "Finish the app", timestamp: Date.now() }]);

const totalText = new Derived([items], (items) => `There are ${items.length} things you need to do.`)

function submit(e: SubmitEvent) {
    e.preventDefault();
    const title = search.get();
    if (title === "") return;
    items.push({ title, timestamp: Date.now() });
}

Div(
    Form(
        Input().id('search').on('input', (e) => search.set(e.target.value)),
        Button().id('submit').content("Create")
    ).classes('search-area').on('submit', submit),

    P().content(totalText),

    Div(
        ForEach(items, ([item, i]) => Div().key(i).content(item.title))
    ).id('list')
).id('list-wrapper').mount(root);
