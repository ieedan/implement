---
title: Context
description: Passing context between components.
section: Control flow
---

Context is a necessary part of any ui framework. Context allows you to scope state to a specific part of the component tree and create state shared between components without it being global to every instance of that component.

In implement we create context with the `context()` function.

```ts
const MyContext = context<MyContextType>();
```

Context is then used in 2 stages.

### 1. Providing the context

You provide the context to child components using the `MyContext.Provide()` method:

```ts
MyContext.Provide(state).To(/* children */);
```

### 2. Using the context

Once you need the context wrap your components in `MyContext.Use()` to get the context:

```ts
MyContext.Use((state) => {
	return; /* children */
});
```

In the example on the right we have a `PlantList` that has been nested within a `PlantListWrapper` to create a prop drilling situation.

Let's use what we have learned to refactor this example to make use of Context instead.

We can start by initializing a new context:

```ts
const PlantListContext = context<Signal<string[]>>();
```

Next let's provide that context to our components:

```ts
PlantListContext.Provide(vegetables).To(PlantListWrapper());
```

Finally we need to use that context in our `PlantList`:

```ts
PlantListContext.Use((items) => {
	return Ul(
		ForEach(
			items,
			(_, index) => index,
			(item) => Li(item),
		),
	);
});
```

Now we can remove all the props fromm `PlantListWrapper` and `PlantList` and everything should still work as it did before but without the prop drilling.
