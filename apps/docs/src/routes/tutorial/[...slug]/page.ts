import { Key, type Child } from "@implementjs/core";
import { tutorials } from "@/lib/tutorials";
import { NotFound } from "@/lib/views/not-found";
import { TutorialPage } from "@/lib/views/tutorial-page";
import type { PageProps } from "./$types";

export default function Page({ params }: PageProps): Child {
	return Key(params.slug, () => {
		const lesson = tutorials.find((entry) => entry.slug === params.slug.get());
		return (lesson ? TutorialPage(lesson) : NotFound())();
	});
}
