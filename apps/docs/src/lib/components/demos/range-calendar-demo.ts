import { signal } from "@implementjs/core";
import { today, type DateRange } from "@implementjs/primitives";
import { RangeCalendar } from "@/lib/components/ui/range-calendar";

export default function RangeCalendarDemo() {
	const value = signal<DateRange>({
		start: today(),
		end: today().add({ days: 4 }),
	});

	return RangeCalendar({ value, calendarLabel: "Trip dates" });
}
