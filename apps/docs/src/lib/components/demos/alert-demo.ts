import { Div } from "@implementjs/core";
import { CircleAlertIcon, TerminalIcon } from "@implementjs/lucide";
import { Alert, AlertDescription, AlertTitle } from "@/lib/components/ui/alert";

export default function AlertDemo() {
	return Div(
		{ class: "flex w-full max-w-lg flex-col gap-4" },
		Alert(
			TerminalIcon({ "aria-hidden": true }),
			AlertTitle("Heads up"),
			AlertDescription("You can add components with the jsrepo CLI."),
		),
		Alert(
			{ variant: "destructive" },
			CircleAlertIcon({ "aria-hidden": true }),
			AlertTitle("Payment failed"),
			AlertDescription("Your card was declined. Try another payment method."),
		),
		Alert(AlertTitle("No icon, no description — just the line.")),
	);
}
