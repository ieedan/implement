import type { LoadEvent } from "./$types";

function readThing() {
	throw new Error("load blew up");
}

export default function load(_event: LoadEvent) {
	return readThing();
}
