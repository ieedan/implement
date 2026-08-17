# Router

What should a router have:

1. Type safe parameters

```ts
const router = new Router({
	"/": () => Home,
	"/issues": {
		"/": () => Issues(),
		":id": {
			"/": (id) => Issue(id),
			layout: (id) => IssueWrapper(),
		},
	},
});

// link will handle type safety for routes and navigating users from layout to layout
export const Link = router.Link;
```
