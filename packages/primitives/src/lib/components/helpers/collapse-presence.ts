import { derived, signal, type Readable, type Ref } from "@implementjs/core";

export type CollapsePresenceOptions = {
	/** Whether the content is open. */
	open: Readable<boolean>;
	/** The content element. */
	ref: Ref<HTMLDivElement>;
	/** CSS variable name the measured height is written to, e.g. `--ip-collapsible-content-height`. */
	heightVar: string;
	/** CSS variable name the measured width is written to. */
	widthVar: string;
	/** Closed content uses hidden="until-found" so find-in-page can reveal it. */
	hiddenUntilFound: boolean;
};

export type CollapsePresence = {
	/** Bind to the `hidden` attribute: stays unset until close animations finish. */
	hidden: Readable<"" | "until-found" | undefined>;
	/** Pass to `Implement.Lifecycle`'s `onMount`; returns its cleanup. */
	onMount: () => () => void;
};

/**
 * Open/close presence for collapsing content, shared by Accordion and
 * Collapsible. Measures the content's natural size into the given CSS
 * variables so keyframes can animate height/width between zero and the
 * measured value, and on close keeps the element rendered until every
 * animation running on it finishes — only then does `hidden` go on.
 */
export function collapsePresence({
	open,
	ref,
	heightVar,
	widthVar,
	hiddenUntilFound,
}: CollapsePresenceOptions): CollapsePresence {
	// Stays true while the close animation plays so `hidden` waits for it.
	const present = signal(open.get());
	// Invalidates a pending hide when the content reopens mid-animation.
	let hideToken = 0;
	// Inline styles as authored, captured before the first measurement overwrites them.
	let originalStyles: { transitionDuration: string; animationName: string } | undefined;
	// Initially-open content must render at rest instead of replaying its open
	// animation on load, so animations stay suppressed until after first paint.
	let isMountAnimationPrevented = open.get();

	// Expose the content's natural size so keyframes can animate height/width
	// between 0 and the measured value. Animations are suspended during the
	// measurement so the rect reflects the resting size.
	const measure = (el: HTMLElement) => {
		originalStyles ??= {
			transitionDuration: el.style.transitionDuration,
			animationName: el.style.animationName,
		};
		el.style.transitionDuration = "0s";
		el.style.animationName = "none";
		const rect = el.getBoundingClientRect();
		el.style.setProperty(heightVar, `${rect.height}px`);
		el.style.setProperty(widthVar, `${rect.width}px`);
		if (!isMountAnimationPrevented) {
			el.style.transitionDuration = originalStyles.transitionDuration;
			el.style.animationName = originalStyles.animationName;
		}
	};

	const hidden = derived([open, present], (open, present) =>
		open || present ? undefined : hiddenUntilFound ? "until-found" : "",
	);

	const onMount = () => {
		const el = ref.get();
		if (el && open.get()) measure(el);
		const raf = requestAnimationFrame(() => (isMountAnimationPrevented = false));

		const unsub = open.onChange((isOpen) => {
			isMountAnimationPrevented = false;
			const el = ref.get();
			if (!el) return;

			if (isOpen) {
				hideToken++;
				present.set(true);
				measure(el);
				return;
			}

			// The element is still visible (`hidden` waits on `present`), so
			// measure now, let the close animation play, then hide.
			measure(el);
			const token = ++hideToken;
			const animations = typeof el.getAnimations === "function" ? el.getAnimations() : [];
			if (animations.length === 0) {
				present.set(false);
				return;
			}
			void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
				if (token === hideToken) present.set(false);
			});
		});

		return () => {
			cancelAnimationFrame(raf);
			unsub();
		};
	};

	return { hidden, onMount };
}
