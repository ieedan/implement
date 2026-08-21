import {
	context,
	Div,
	Img,
	Implement,
	isReadable,
	signal,
	Span,
	type Child,
	type ComponentProps,
	type ReadableSource,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";

export type AvatarLoadingStatus = "loading" | "loaded" | "error";

export type AvatarRootProps = ComponentProps<typeof Div> & {
	/** How long to wait after the image loads before showing it. Prevents a flash on fast connections. */
	delayMs?: number;
	onLoadingStatusChange?: (status: AvatarLoadingStatus) => void;
};

const AvatarCtx = context<AvatarState>();

function currentValue<T extends string>(
	value: T | ReadableSource<T | undefined> | undefined,
): T | undefined {
	if (typeof value === "string") return value;
	return value?.get();
}

class AvatarState {
	loadingStatus = signal<AvatarLoadingStatus>("loading");

	constructor(readonly opts: Pick<AvatarRootProps, "delayMs" | "onLoadingStatusChange">) {
		if (opts.onLoadingStatusChange) {
			this.loadingStatus.onChange((status) => opts.onLoadingStatusChange?.(status));
		}
	}

	get isLoaded() {
		return this.loadingStatus.bind((status) => status === "loaded");
	}

	loadImage(
		src: string | undefined,
		crossOrigin: string | undefined,
		referrerPolicy: string | undefined,
	) {
		if (!src) {
			this.loadingStatus.set("error");
			return () => {};
		}

		let timerId: number | undefined;
		const listeners = new AbortController();
		// preload through a detached Image so status is right even when the
		// rendered img is display: none
		const image = new Image();
		this.loadingStatus.set("loading");
		image.addEventListener(
			"load",
			() => {
				const delayMs = this.opts.delayMs ?? 0;
				if (delayMs > 0) {
					timerId = window.setTimeout(() => this.loadingStatus.set("loaded"), delayMs);
				} else {
					this.loadingStatus.set("loaded");
				}
			},
			{ once: true, signal: listeners.signal },
		);
		image.addEventListener("error", () => this.loadingStatus.set("error"), {
			once: true,
			signal: listeners.signal,
		});
		if (crossOrigin !== undefined) image.crossOrigin = crossOrigin;
		if (referrerPolicy !== undefined) image.referrerPolicy = referrerPolicy;
		image.src = src;

		return () => {
			listeners.abort();
			window.clearTimeout(timerId);
		};
	}
}

export const Avatar = createComponent(function Avatar(
	{ id = getId(), delayMs = 0, onLoadingStatusChange, ...restProps }: AvatarRootProps,
	...children: Child[]
) {
	const state = new AvatarState({ delayMs, onLoadingStatusChange });

	return AvatarCtx.Provide(state).To(
		Div(
			mergeProps({ id, "data-avatar-root": "", "data-status": state.loadingStatus }, restProps),
			...children,
		),
	);
});

export type AvatarImageProps = ComponentProps<typeof Img>;

export const AvatarImage = createComponent(function AvatarImage({
	id = getId(),
	src,
	crossOrigin,
	referrerPolicy,
	...restProps
}: AvatarImageProps) {
	return AvatarCtx.Use((state) => {
		const load = () =>
			state.loadImage(currentValue(src), currentValue(crossOrigin), currentValue(referrerPolicy));

		return Implement.Lifecycle(
			{
				onMount: () => {
					if (!isReadable(src)) return load();
					let cancel = load();
					const unsubscribe = src.subscribe(() => {
						cancel();
						cancel = load();
					});
					return () => {
						unsubscribe();
						cancel();
					};
				},
			},
			Img(
				mergeProps(
					{
						id,
						"data-avatar-image": "",
						"data-status": state.loadingStatus,
						src,
						crossOrigin,
						referrerPolicy,
						style: { display: state.isLoaded.bind((loaded) => (loaded ? "" : "none")) },
					},
					restProps,
				),
			),
		);
	});
});

export type AvatarFallbackProps = ComponentProps<typeof Span>;

export const AvatarFallback = createComponent(function AvatarFallback(
	{ id = getId(), ...restProps }: AvatarFallbackProps,
	...children: Child[]
) {
	return AvatarCtx.Use((state) => {
		return Span(
			mergeProps(
				{
					id,
					"data-avatar-fallback": "",
					"data-status": state.loadingStatus,
					style: { display: state.isLoaded.bind((loaded) => (loaded ? "none" : "")) },
				},
				restProps,
			),
			...children,
		);
	});
});
