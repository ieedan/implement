export default function load({ url }: { url: URL }) {
	return { message: `loaded ${url.pathname}` };
}
