import {
	lucide as lucidePages,
	pages,
	primitives as primitivePages,
	tutorials as generated,
	type LucidePage,
	type Page,
	type PrimitivePage,
	type Tutorial as GeneratedTutorial,
} from "../../.velite";
import { stripLessonSource } from "./lesson-source";

export { lucidePages, pages, primitivePages, type LucidePage, type Page, type PrimitivePage };

const codeFiles = import.meta.glob<string>("../content/lessons/**/code.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

const solutionFiles = import.meta.glob<string>("../content/lessons/**/solution.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

const testFiles = import.meta.glob<string>("../content/lessons/**/test.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

export type Tutorial = Omit<GeneratedTutorial, "lessonDir"> & {
	code: string;
	solution: string;
	test: string | null;
};

export const tutorials: Tutorial[] = generated.map(({ lessonDir, ...lesson }) => ({
	...lesson,
	code: sidecar(codeFiles, lessonDir, "code.ts"),
	solution: sidecar(solutionFiles, lessonDir, "solution.ts"),
	test: testFiles[`../content/lessons/${lessonDir}/test.ts`] ?? null,
}));

function sidecar(
	files: Record<string, string>,
	lessonDir: string,
	filename: "code.ts" | "solution.ts",
): string {
	const source = files[`../content/lessons/${lessonDir}/${filename}`];
	if (source == null) {
		throw new Error(`Missing ${filename} next to lessons/${lessonDir}/index.md`);
	}
	return stripLessonSource(source);
}
