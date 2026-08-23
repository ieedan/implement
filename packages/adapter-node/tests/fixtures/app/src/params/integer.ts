import { matcher, mismatch } from "@implementjs/kit/params";

export default matcher((value) => {
	const parsed = Number(value);
	return /^\d+$/.test(value) ? parsed : mismatch;
});
