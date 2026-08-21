import { Div } from "@implementjs/core";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/lib/components/ui/alert-dialog";

export default function AlertDialogDemo() {
	return AlertDialog(
		AlertDialogTrigger({ variant: "outline" }, "Delete account"),
		AlertDialogContent(
			Div(
				{ class: "grid gap-1.5" },
				AlertDialogTitle("Are you absolutely sure?"),
				AlertDialogDescription(
					"This action cannot be undone. This will permanently delete your account and remove your data from our servers.",
				),
			),
			Div(
				{ class: "flex justify-end gap-2" },
				AlertDialogCancel("Cancel"),
				AlertDialogAction({ variant: "destructive" }, "Delete account"),
			),
		),
	);
}
