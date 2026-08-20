import type { Child, ComponentProps } from "@implementjs/core";
import {
	Avatar as AvatarPrimitive,
	AvatarFallback as AvatarFallbackPrimitive,
	AvatarImage as AvatarImagePrimitive,
} from "@implementjs/primitives";

export type AvatarProps = ComponentProps<typeof AvatarPrimitive>;
export type AvatarImageProps = ComponentProps<typeof AvatarImagePrimitive>;
export type AvatarFallbackProps = ComponentProps<typeof AvatarFallbackPrimitive>;

export function Avatar({ class: className, ...props }: AvatarProps, ...children: Child[]) {
	return AvatarPrimitive(
		{
			...props,
			"data-slot": "avatar",
			class: ["relative flex size-8 shrink-0 overflow-hidden rounded-full", className],
		},
		...children,
	);
}

export function AvatarImage({ class: className, ...props }: AvatarImageProps) {
	return AvatarImagePrimitive({
		...props,
		"data-slot": "avatar-image",
		class: ["aspect-square size-full", className],
	});
}

export function AvatarFallback(
	{ class: className, ...props }: AvatarFallbackProps,
	...children: Child[]
) {
	return AvatarFallbackPrimitive(
		{
			...props,
			"data-slot": "avatar-fallback",
			class: ["flex size-full items-center justify-center rounded-full bg-muted", className],
		},
		...children,
	);
}
