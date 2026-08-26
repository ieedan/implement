/**
 * Compile-time checks for the props the styled components take. Nothing here
 * runs: `tsc --noEmit` over this file *is* the test, and a `@ts-expect-error`
 * that stops erroring fails the build like a broken assertion would.
 *
 * `@implementjs/primitives` has one of these for the primitives themselves.
 * This is the same assertion one layer up, where a project actually writes its
 * props: nearly every component here takes its props straight off the
 * primitive through `ComponentProps<typeof …>`, so the only way the styled
 * layer can be narrower than what it wraps is a hand-written prop — which is
 * exactly what `SidebarMenuButton.disabled` is.
 *
 * It lives beside `ui/` rather than in it because `jsrepo.config.ts` turns
 * every `.ts` file in that directory into a registry item, and a test is not
 * something to install.
 */

import { derived, signal } from "@implementjs/core";
import { Accordion, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { AspectRatio } from "./ui/aspect-ratio";
import { Collapsible } from "./ui/collapsible";
import { CommandItem } from "./ui/command";
import { ContextMenu, ContextMenuTrigger } from "./ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { LinkPreview } from "./ui/link-preview";
import { Menubar, MenubarMenu, MenubarTrigger } from "./ui/menubar";
import { Meter } from "./ui/meter";
import { Progress } from "./ui/progress";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { RatingGroup } from "./ui/rating-group";
import { Select, SelectItem } from "./ui/select";
import { SidebarMenuButton } from "./ui/sidebar";
import { Switch } from "./ui/switch";
import { Tabs, TabsTrigger } from "./ui/tabs";
import { Toggle } from "./ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Tooltip, TooltipTrigger } from "./ui/tooltip";

const board = signal<"private" | "public">("private");
/** The shape a prop gets from loaded data: read-only, and not a `Signal`. */
const isPublic = derived([board], (value) => value === "public");
const isPrivate = board.bind((value) => value === "private");
const locked = signal(true);

// --- a read-only prop takes anything readable ------------------------------

DropdownMenu(DropdownMenuTrigger({ disabled: isPrivate }, "Visibility"));
DropdownMenu(DropdownMenuTrigger({ disabled: isPublic }, "Visibility"));
DropdownMenu(DropdownMenuTrigger({ disabled: locked }, "Visibility"));
DropdownMenu(DropdownMenuTrigger({ disabled: true }, "Visibility"));
DropdownMenu(DropdownMenuItem({ disabled: isPublic }, "Delete"));
DropdownMenu(DropdownMenuSubTrigger({ disabled: isPublic }, "More"));
ContextMenu(ContextMenuTrigger({ disabled: isPublic }, "Right click me"));
Menubar(MenubarMenu(MenubarTrigger({ disabled: isPublic }, "File")));

Accordion({ disabled: isPublic }, AccordionItem({ value: "a", disabled: isPublic }));
Accordion(AccordionItem({ value: "a" }, AccordionTrigger({ disabled: isPublic }, "Item")));
RadioGroup({ disabled: isPublic }, RadioGroupItem({ value: "a", disabled: isPublic }));
ToggleGroup({ disabled: isPublic }, ToggleGroupItem({ value: "a", disabled: isPublic }));
Tabs({ disabled: isPublic }, TabsTrigger({ value: "a", disabled: isPublic }, "Tab"));
RatingGroup({ disabled: isPublic });
Toggle({ disabled: isPublic }, "Bold");
Select(SelectItem({ value: "a", disabled: isPublic }, "A"));
Tooltip(TooltipTrigger({ disabled: isPublic }, "Hover me"));
LinkPreview({ disabled: isPublic });
CommandItem({ disabled: isPublic }, "Open");

// the row a collapsed sidebar shows as a tooltip: `disabled` is written out by
// hand here, so it is the one that can drift from the primitive it forwards to
SidebarMenuButton({ disabled: isPublic, tooltip: "Inbox" }, "Inbox");
SidebarMenuButton({ disabled: locked }, "Inbox");
SidebarMenuButton({ disabled: true }, "Inbox");

Meter({ value: isPublic.bind((open) => (open ? 100 : 0)), min: 0, max: 100 });
Progress({ value: isPublic.bind((open) => (open ? 100 : 0)) });
AspectRatio({ ratio: isPublic.bind((open) => (open ? 16 / 9 : 1)) });

// --- the styling props survive the widened read-only ones -------------------

// a narrowed `disabled` used to knock these calls out of the props overload,
// and the error TypeScript reported was about `variant`, not the prop at fault
Toggle({ disabled: isPublic, variant: "outline", size: "sm" }, "Bold");
ToggleGroup({ disabled: isPublic }, ToggleGroupItem({ value: "a", variant: "outline" }, "A"));
Tabs(TabsTrigger({ value: "a", disabled: isPublic, variant: "underline" }, "Tab"));
Tooltip(TooltipTrigger({ disabled: isPublic, variant: "ghost", size: "sm" }, "Hover me"));

// --- a prop the component writes back to still asks for a Signal -----------

const open = signal(false);
Collapsible({ open });
Switch({ checked: open });

// @ts-expect-error open is two-way: a derived value has nowhere to write back to
Collapsible({ open: isPublic });
// @ts-expect-error checked is two-way: a derived value has nowhere to write back to
Switch({ checked: isPublic });
