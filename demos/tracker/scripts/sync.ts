import { sync } from "@implementjs/kit/sync";

// Writes .implement/ (entries, tsconfig, ./$types) without running vite, so `check` works on a
// fresh clone. Keep any kit() options that affect codegen in step with vite.config.ts.
sync(new URL("..", import.meta.url).pathname);
