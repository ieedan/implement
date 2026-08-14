import { Div, Button, P, Input } from "./lib/components";
import { Signal } from "./lib/signal";

const root = document.getElementById('root')!;

let count = new Signal(0);
let input = new Signal('');

const div = new Div(
    new Button()
        .id('counter')
        .content('Click me!')
        .on('click', () => {
            count.set(count.get() + 1);
        }),
    new P().content({
        signals: [count],
        value: (count) => `Clicked ${count} times!`
    }),
    new Button().content('Reset').on('click', () => {
        count.set(0);
    }),

    new Input().on('input', (e) => {
        const target = e.target as HTMLInputElement;
        input.set(target.value);
    }),
    new P().content({
        signals: [input],
        value: (input) => `You typed: ${input}`
    })
)
    .id('app')
    .classes('bg-background');

div.mount(root);
