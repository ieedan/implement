import { error, socket } from "@implementjs/kit/server";

/**
 * A socket route, so the build proves the whole chain end to end: the scan
 * notices `SOCKET`, the generated entry exports `upgrade`, and the server this
 * adapter writes attaches an `upgrade` listener for it.
 */
export const SOCKET = socket({
	upgrade: ({ locals }) => {
		if (locals.user === null) error(401, "who are you?");
	},
	open: (peer) => peer.send(`hello ${peer.locals.user}`),
	message: (peer, message) => peer.send(message.text().toUpperCase()),
});
