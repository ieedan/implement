import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CreateOptions, runCreate } from "@/commands/create";
import type { AbsolutePath } from "@/utils/types";
import { unwrap, unwrapErr } from "./utils";

const prompts = vi.hoisted(() => ({
	text: vi.fn(),
	select: vi.fn(),
	multiselect: vi.fn(),
	confirm: vi.fn(),
}));

vi.mock("@clack/prompts", async (importOriginal) => ({
	...(await importOriginal<typeof import("@clack/prompts")>()),
	...prompts,
}));

let cwd: AbsolutePath;
const wasTTY = process.stdout.isTTY;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "create-implement-app-")) as AbsolutePath;
	// the interactive path only runs when someone is there to answer
	process.stdout.isTTY = true;
	prompts.text.mockResolvedValue("prompted-app");
	prompts.select.mockResolvedValue("csr");
	prompts.multiselect.mockResolvedValue(["icons", "tailwind"]);
	prompts.confirm.mockResolvedValue(true);
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
	process.stdout.isTTY = wasTTY;
	vi.clearAllMocks();
});

function options(overrides: Partial<CreateOptions> = {}): CreateOptions {
	return {
		cwd,
		install: false,
		git: false,
		workspace: false,
		overwrite: false,
		yes: false,
		verbose: false,
		...overrides,
	};
}

describe("runCreate (interactive)", () => {
	it("asks for the directory, the template, and the addons", async () => {
		const result = await runCreate(undefined, options());

		const value = unwrap(result);
		expect(value.name).toBe("prompted-app");
		expect(value.template).toBe("csr");
		// selections come back in the canonical order, not the order they were clicked
		expect(value.addons).toEqual(["tailwind", "icons"]);
	});

	it("doesn't ask for anything a flag already answered", async () => {
		await runCreate("my-app", options({ template: "kit" }));

		expect(prompts.text).not.toHaveBeenCalled();
		expect(prompts.select).not.toHaveBeenCalled();
	});

	it("seeds the addon prompt with the flags and the defaults", async () => {
		await runCreate("my-app", options({ icons: true, tailwind: false }));

		expect(prompts.multiselect).toHaveBeenCalledWith(
			expect.objectContaining({ initialValues: ["icons"] }),
		);
	});

	it("skips every prompt with --yes", async () => {
		const result = await runCreate("my-app", options({ yes: true }));

		expect(prompts.text).not.toHaveBeenCalled();
		expect(prompts.select).not.toHaveBeenCalled();
		expect(prompts.multiselect).not.toHaveBeenCalled();
		expect(unwrap(result).template).toBe("kit");
	});

	it("confirms before writing into a directory that isn't empty", async () => {
		await runCreate("my-app", options());
		prompts.text.mockResolvedValue("my-app");

		const result = await runCreate(undefined, options());

		expect(prompts.confirm).toHaveBeenCalled();
		expect(result.isOk()).toBe(true);
	});

	it("stops when the overwrite confirmation is declined", async () => {
		await runCreate("my-app", options());
		prompts.confirm.mockResolvedValue(false);

		const result = await runCreate("my-app", options());

		expect(unwrapErr(result).toString()).toContain("is not empty");
	});
});
