import type { Child } from "@implementjs/core";
import { PackagesPage } from "@/lib/views/packages";
import type { PageProps } from "./$types";

export default function Page({ data }: PageProps): Child {
	return PackagesPage(data);
}
