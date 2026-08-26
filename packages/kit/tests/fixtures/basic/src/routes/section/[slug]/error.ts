import { P, type Child } from "@implementjs/core";
import type { ErrorProps } from "./$types";

/** The section's own error page, rendered inside the section's shell. */
export default function ErrorPage({ error }: ErrorProps): Child {
	return P(`section says ${error.code}`);
}
