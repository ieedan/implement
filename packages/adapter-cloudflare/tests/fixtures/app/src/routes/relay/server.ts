import { error, socket } from "@implementjs/kit/server";

/**
 * A socket route, so the built worker carries the upgrade path — and so the
 * refusal below can be exercised without a workerd to hand out a real
 * `WebSocketPair`.
 */
export const SOCKET = socket({
	upgrade: ({ locals }) => {
		if (locals.user === null) error(401, "who are you?");
	},
	message: (peer, message) => peer.send(message.text().toUpperCase()),
});

export function GET(): Response {
	return Response.json({ ok: true });
}
