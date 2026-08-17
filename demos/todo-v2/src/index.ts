import { App, Div } from '@packages/ui_v2';

const app = App({ target: document.body });

app.render(
	Div("Todo App"),
	Div({ class: 'list' }, 
		
	)
)
