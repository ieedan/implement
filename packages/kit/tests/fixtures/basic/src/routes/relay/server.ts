import { error } from "@implementjs/kit/server";
import { socket } from "./$types";

/** A socket route, so the dev server's upgrade path has something to serve. */
export const SOCKET = socket({
	upgrade: ({ locals }) => {
		if (locals.user === null) error(401, "who are you?");
	},
	open: (peer) => peer.send(`hello ${peer.locals.user}`),
	message: (peer, message) => peer.send(message.text().toUpperCase()),
});
