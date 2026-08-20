import {
	kit as kitPages,
	lucide as lucidePages,
	pages,
	primitives as primitivePages,
	tutorials as generated,
	type KitPage,
	type LucidePage,
	type Page,
	type PrimitivePage,
	type Tutorial as GeneratedTutorial,
} from "../../.velite";
import { stripLessonSource } from "./lesson-source";

export {
	kitPages,
	lucidePages,
	pages,
	primitivePages,
	type KitPage,
	type LucidePage,
	type Page,
	type PrimitivePage,
};

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

const appFiles = import.meta.glob<string>("../content/lessons/**/app/**/*", {
	query: "?raw",
	import: "default",
	eager: true,
});

const appSolutionFiles = import.meta.glob<string>("../content/lessons/**/solution/**/*", {
	query: "?raw",
	import: "default",
	eager: true,
});

const testFiles = import.meta.glob<string>("../content/lessons/**/test.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** One editable file of a lesson, with its path relative to the lesson project. */
export type LessonFile = { path: string; content: string };

export type Tutorial = Omit<GeneratedTutorial, "lessonDir"> & {
	/** Starter files shown in the editor; single-file lessons hold one `index.ts`. */
	files: LessonFile[];
	/** Solved contents, matched to `files` by path. */
	solution: LessonFile[];
	test: string | null;
};

export const tutorials: Tutorial[] = generated.map(({ lessonDir, ...lesson }) => ({
	...lesson,
	files: lessonFiles(lessonDir),
	solution: lessonSolutionFiles(lessonDir),
	test: testFiles[`../content/lessons/${lessonDir}/test.ts`] ?? null,
}));

/**
 * A lesson is either a single-file playground (`code.ts` / `solution.ts`
 * sidecars) or a multi-file app (`app/` / `solution/` directories mirroring a
 * project root, e.g. `app/src/routes/index.ts`).
 */
function lessonFiles(lessonDir: string): LessonFile[] {
	const app = dirFiles(appFiles, lessonDir, "app");
	if (app.length > 0) return app;
	const single = codeFiles[`../content/lessons/${lessonDir}/code.ts`];
	if (single == null) {
		throw new Error(`Missing code.ts or app/ next to lessons/${lessonDir}/index.md`);
	}
	return [{ path: "index.ts", content: stripLessonSource(single) }];
}

function lessonSolutionFiles(lessonDir: string): LessonFile[] {
	const app = dirFiles(appSolutionFiles, lessonDir, "solution");
	if (app.length > 0) return app;
	const single = solutionFiles[`../content/lessons/${lessonDir}/solution.ts`];
	if (single == null) {
		throw new Error(`Missing solution.ts or solution/ next to lessons/${lessonDir}/index.md`);
	}
	return [{ path: "index.ts", content: stripLessonSource(single) }];
}

function dirFiles(
	files: Record<string, string>,
	lessonDir: string,
	dirname: "app" | "solution",
): LessonFile[] {
	const prefix = `../content/lessons/${lessonDir}/${dirname}/`;
	return Object.entries(files)
		.filter(([key]) => key.startsWith(prefix))
		.map(([key, content]) => ({
			path: key.slice(prefix.length),
			content: stripLessonSource(content),
		}))
		.sort((a, b) => a.path.localeCompare(b.path));
}
