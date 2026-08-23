import { matcher, mismatch } from "@implementjs/kit/params";

/** A parsing matcher: `[id=integer]` binds a `number`, not a `string`. */
export default matcher((value) => {
	const parsed = Number(value);
	return /^\d+$/.test(value) ? parsed : mismatch;
});
