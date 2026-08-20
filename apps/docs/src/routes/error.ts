import type { Child } from "@implementjs/core";
import { NotFound } from "@/views/not-found";

export default function ErrorPage(): Child {
	return NotFound();
}
