import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { NewCourseForm } from "@/components/courses/NewCourseForm";

export const metadata = { title: "New course" };

export default async function NewCoursePage() {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");
	return (
		<div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Courses", href: "/dashboard/admin/courses" }, { label: "New", active: true }]} />
			<NewCourseForm />
		</div>
	);
}
