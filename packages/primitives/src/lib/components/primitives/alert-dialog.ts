import { Portal, type Child, type PortalProps } from "@implementjs/core";
import {
	ModalContent,
	ModalDescription,
	ModalClose,
	ModalOverlay,
	ModalRoot,
	ModalState,
	ModalTitle,
	ModalTrigger,
	type ModalCloseProps,
	type ModalContentProps,
	type ModalDescriptionProps,
	type ModalOverlayProps,
	type ModalRootOptions,
	type ModalTitleProps,
	type ModalTriggerProps,
} from "./modal";
import { createComponent } from "../../create-component";

export type AlertDialogRootProps = ModalRootOptions;

/**
 * A modal that demands a response before anything else can happen. Built on
 * the shared modal base like Dialog, but the content is `role="alertdialog"`,
 * clicking outside does not dismiss it, and focus starts on the cancel
 * button so the destructive action needs a deliberate move.
 */
export const AlertDialog = createComponent(function AlertDialog(
	props: AlertDialogRootProps,
	...children: Child[]
) {
	const state = new ModalState(
		{ name: "alert-dialog", role: "alertdialog", interactOutsideBehavior: "ignore" },
		props,
	);
	return ModalRoot(state, ...children);
});

export type AlertDialogTriggerProps = ModalTriggerProps;
export const AlertDialogTrigger = ModalTrigger;

export type AlertDialogContentProps = ModalContentProps;
export const AlertDialogContent = ModalContent;

export type AlertDialogOverlayProps = ModalOverlayProps;
export const AlertDialogOverlay = ModalOverlay;

export type AlertDialogTitleProps = ModalTitleProps;
export const AlertDialogTitle = ModalTitle;

export type AlertDialogDescriptionProps = ModalDescriptionProps;
export const AlertDialogDescription = ModalDescription;

export type AlertDialogPortalProps = PortalProps;
export const AlertDialogPortal = Portal;

export type AlertDialogCancelProps = ModalCloseProps;

/**
 * Closes without confirming. Receives focus when the alert dialog opens, so
 * Enter or Space backs out instead of confirming.
 */
export const AlertDialogCancel = createComponent(function AlertDialogCancel(
	props: AlertDialogCancelProps,
	...children: Child[]
) {
	return ModalClose(
		{ dataAttribute: "alert-dialog-cancel", initialFocus: true },
		props,
		...children,
	);
});

export type AlertDialogActionProps = ModalCloseProps;

/** Confirms and closes. Attach the actual work to `onClick`. */
export const AlertDialogAction = createComponent(function AlertDialogAction(
	props: AlertDialogActionProps,
	...children: Child[]
) {
	return ModalClose({ dataAttribute: "alert-dialog-action" }, props, ...children);
});
