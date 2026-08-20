import { Div } from "@implementjs/core";
import { Button } from "@/lib/components/ui/button";
import { createToastManager, Toaster, type ToasterToastData } from "@/lib/components/ui/toast";

const manager = createToastManager();

function saveDocument() {
	return new Promise<string>((resolve) => setTimeout(() => resolve("Quarterly report"), 2000));
}

export default function ToastDemo() {
	return Div(
		{ class: "flex flex-wrap items-center justify-center gap-2" },
		Toaster({ manager }),
		Button(
			{
				variant: "outline",
				onClick: () =>
					manager.add({
						title: "Event created",
						description: "Friday, August 21 at 4:00 PM",
					}),
			},
			"Show toast",
		),
		Button(
			{
				variant: "outline",
				onClick: () =>
					manager.add({
						type: "success",
						title: "Changes saved",
					}),
			},
			"Success",
		),
		Button(
			{
				variant: "outline",
				onClick: () =>
					manager.add({
						type: "error",
						title: "Something went wrong",
						description: "The changes could not be saved.",
					}),
			},
			"Error",
		),
		Button(
			{
				variant: "outline",
				onClick: () =>
					manager.add({
						title: "Message archived",
						data: {
							action: {
								label: "Undo",
								onClick: () => manager.add({ title: "Message restored" }),
							},
						} satisfies ToasterToastData,
					}),
			},
			"With action",
		),
		Button(
			{
				variant: "outline",
				onClick: () =>
					manager.promise(saveDocument(), {
						loading: "Saving document…",
						success: (name) => `${name} saved`,
						error: "Could not save the document",
					}),
			},
			"Promise",
		),
	);
}
