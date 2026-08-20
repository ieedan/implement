import { sync } from "@implementjs/kit/sync";

sync(new URL("..", import.meta.url).pathname);
