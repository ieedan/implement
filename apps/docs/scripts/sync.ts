import { sync } from "@implementjs/kit/sync";

// Keep the alias map in step with the kit() options in vite.config.ts.
sync(new URL("..", import.meta.url).pathname, {
	alias: { "@": "src", "@tutorial/test": "src/lib/tutorial-test.ts" },
});
