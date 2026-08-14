import { Div, P, Input, Button } from "./lib/components";
import { Signal } from "./lib/signal";

const root = document.getElementById('root')!;

let count = new Signal(0);
let input = new Signal('');

const div = Div(
    Button()
        .id('counter')
        .content('Click me!')
        .on('click', () => {
            count.set(count.get() + 1);
        }),
    P().content([count], (count) => `Clicked ${count} times!`),
    Button().content('Reset').on('click', () => {
        count.set(0);
    }),

    Input().on('input', (e) => {
        const target = e.target as HTMLInputElement;
        input.set(target.value);
    }),
    P().content([input], (input) => `You typed: ${input}`)
)
    .id('app')
    .classes('bg-background');

div.mount(root);
