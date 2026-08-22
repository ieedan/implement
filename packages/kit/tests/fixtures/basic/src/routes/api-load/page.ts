import { P } from "@implementjs/core";
import type { PageProps } from "./$types";

export default function ApiLoadPage({ data }: PageProps) {
	return P(data.bind((value) => JSON.stringify(value.post)));
}
