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

export type DialogRootProps = ModalRootOptions;

/**
 * A modal window that interrupts the page until dismissed. Built on the
 * shared modal base; see AlertDialog for the confirmation flavor.
 */
export const Dialog = createComponent(function Dialog(props: DialogRootProps, ...children: Child[]) {
	const state = new ModalState(
		{ name: "dialog", role: "dialog", interactOutsideBehavior: "close" },
		props,
	);
	return ModalRoot(state, ...children);
});

export type DialogTriggerProps = ModalTriggerProps;
export const DialogTrigger = ModalTrigger;

export type DialogContentProps = ModalContentProps;
export const DialogContent = ModalContent;

export type DialogOverlayProps = ModalOverlayProps;
export const DialogOverlay = ModalOverlay;

export type DialogTitleProps = ModalTitleProps;
export const DialogTitle = ModalTitle;

export type DialogDescriptionProps = ModalDescriptionProps;
export const DialogDescription = ModalDescription;

export type DialogPortalProps = PortalProps;
export const DialogPortal = Portal;

export type DialogCloseProps = ModalCloseProps;

export const DialogClose = createComponent(function DialogClose(props: DialogCloseProps, ...children: Child[]) {
	return ModalClose({}, props, ...children);
});
