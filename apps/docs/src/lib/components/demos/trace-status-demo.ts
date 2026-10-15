import {
	CircleAlertIcon,
	CircleCheckIcon,
	CircleIcon,
	LoaderCircleIcon,
} from "@implementjs/lucide";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/lib/components/ui/trace";

export default function TraceStatusDemo() {
	return Trace(
		{ class: "max-w-sm" },
		TraceLine(TraceIcon(CircleCheckIcon()), TraceTitle("Ran pnpm install")),
		TraceLine(
			{ status: "error" },
			TraceIcon(CircleAlertIcon()),
			TraceTitle("Failed to run pnpm lint"),
		),
		TraceLine(
			{ status: "running" },
			TraceIcon(LoaderCircleIcon({ class: "animate-spin" })),
			TraceTitle("Running pnpm build"),
		),
		TraceLine({ status: "pending" }, TraceIcon(CircleIcon()), TraceTitle("Run pnpm test")),
	);
}
