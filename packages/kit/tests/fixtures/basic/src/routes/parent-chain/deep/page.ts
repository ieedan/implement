import { P } from "@implementjs/core";
import type { PageProps } from "./$types";

export default function DeepPage({ data }: PageProps) {
	return P(data.bind("title"));
}
