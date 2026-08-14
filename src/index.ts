import { Div, P, Input, Button } from "./lib/components";
import { Signal } from "./lib/signal";

const root = document.getElementById('root')!;

let count = new Signal(0);
let input = new Signal('');
let dialogOpen = new Signal(false);

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
    P().content([input], (input) => `You typed: ${input}`),

    Button().content('Toggle Dialog').on('click', () => {
        dialogOpen.set(!dialogOpen.get())
    })
)
    .id('app')
    .classes('bg-background');

Div().content('Hello there!')
    .renderIf([dialogOpen], (dialogOpen) => dialogOpen).mount(root);

div.mount(root);
