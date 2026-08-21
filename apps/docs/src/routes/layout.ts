import { Fragment, type Child } from "@implementjs/core";
import { ModeWatcher } from "@implementjs/mode-watcher";
import { mode } from "@/lib/mode";
import type { LayoutProps } from "./$types";
import "../app.css";

export default function Layout({ children }: LayoutProps): Child {
	// Root layout, so this stays mounted for the life of the app: the blocking
	// script it renders into the head puts the stored mode on <html> before the
	// first paint, prerendered pages included.
	return Fragment(ModeWatcher({ manager: mode }), children);
}
