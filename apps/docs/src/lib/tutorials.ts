import { tutorials, type Tutorial } from "./content";

export type TutorialSection = {
	name: string;
	lessons: Tutorial[];
};

export function tutorialSections(): TutorialSection[] {
	const sections: TutorialSection[] = [];
	for (const lesson of tutorials) {
		const last = sections.at(-1);
		if (last != null && last.name === lesson.section) {
			last.lessons.push(lesson);
		} else {
			sections.push({ name: lesson.section, lessons: [lesson] });
		}
	}
	return sections;
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
