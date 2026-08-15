const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact relative timestamp: "2m", "5h", "3d", then "Aug 12". */
export function formatRelative(timestamp: number): string {
	const elapsed = Date.now() - timestamp;
	const minutes = Math.floor(elapsed / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 14) return `${days}d`;
	const date = new Date(timestamp);
	return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Sentence-friendly variant: "just now", "5h ago", "on Aug 12". */
export function formatAgo(timestamp: number): string {
	const relative = formatRelative(timestamp);
	if (relative === "now") return "just now";
	if (/^\d/.test(relative)) return `${relative} ago`;
	return `on ${relative}`;
}
