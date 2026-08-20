import { tutorials, type Tutorial } from "./content";

export type TutorialSection = {
	name: string;
	lessons: Tutorial[];
};

export type TutorialPart = {
	/** Top-level grouping — "implement" for the core lessons, "kit" for the framework. */
	name: string;
	sections: TutorialSection[];
};

export function tutorialParts(): TutorialPart[] {
	const parts: TutorialPart[] = [];
	for (const lesson of tutorials) {
		let part: TutorialPart | undefined = parts.at(-1);
		if (part == null || part.name !== lesson.part) {
			part = { name: lesson.part, sections: [] };
			parts.push(part);
		}
		const section = part.sections.at(-1);
		if (section != null && section.name === lesson.section) {
			section.lessons.push(lesson);
		} else {
			part.sections.push({ name: lesson.section, lessons: [lesson] });
		}
	}
	return parts;
}

export function tutorialNeighbors(lesson: Tutorial): {
	prev: Tutorial | undefined;
	next: Tutorial | undefined;
	index: number;
} {
	const index = tutorials.findIndex((item) => item.permalink === lesson.permalink);
	return {
		index,
		prev: index > 0 ? tutorials[index - 1] : undefined,
		next: index >= 0 ? tutorials[index + 1] : undefined,
	};
}
