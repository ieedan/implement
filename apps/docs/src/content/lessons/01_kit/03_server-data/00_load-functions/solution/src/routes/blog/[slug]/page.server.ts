// Pretend this object is a database only the server can reach.
const POSTS = {
	"hello-world": {
		title: "Hello world",
		body: "The first post, fresh off the server.",
	},
	"loading-data": {
		title: "Loading data",
		body: "This text was returned by a load function, not shipped as page code.",
	},
};

export default function load({ params }) {
	return { post: POSTS[params.slug] ?? null };
}
