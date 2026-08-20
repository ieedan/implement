import { signal } from "@implementjs/core";
import { today, type CalendarDate } from "@implementjs/primitives";
import { Calendar } from "@/lib/components/ui/calendar";

export default function CalendarDemo() {
	const value = signal<CalendarDate | null>(today());

	return Calendar({ value, calendarLabel: "Appointment date" });
}
