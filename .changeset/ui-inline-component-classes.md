---
"@implementjs/ui": patch
---

Every component writes its classes where they are used, instead of importing
them from another component's file.

`dropdown-menu.ts` used to export the menu look — `menuContentClasses`,
`menuItemClasses`, the indicator helpers — and the context menu, menubar, and
select imported it. `calendar.ts` did the same for the range calendar. Reading
any of those files meant opening two, and adding one component to a project
dragged another in behind it.

The classes now sit inline in the `cn(...)` call that uses them, so each file
reads top to bottom on its own and installs on its own:

- `context-menu`, `menubar`, and `select` no longer pull in `dropdown-menu`
- `range-calendar` no longer pulls in `calendar`

Nothing renders differently. The trade is that the menus are four copies of one
look rather than one shared source — restyling them all means the same edit in
each file, which is the deal every other component in the registry was already
on.

`CalendarMonthGrid` loses its trailing `dayClasses` argument; `Cell` and `Day`
are still there to swap parts in.
