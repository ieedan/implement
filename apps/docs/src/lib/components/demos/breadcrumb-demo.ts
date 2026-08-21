import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/lib/components/ui/breadcrumb";

export default function BreadcrumbDemo() {
	return Breadcrumb(
		BreadcrumbList(
			BreadcrumbItem(BreadcrumbLink({ href: "/docs" }, "Docs")),
			BreadcrumbSeparator(),
			BreadcrumbItem(BreadcrumbEllipsis()),
			BreadcrumbSeparator(),
			BreadcrumbItem(BreadcrumbLink({ href: "/ui" }, "UI")),
			BreadcrumbSeparator(),
			BreadcrumbItem(BreadcrumbPage("Breadcrumb")),
		),
	);
}
