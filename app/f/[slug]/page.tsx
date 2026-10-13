import { getPublicForm } from "@/app/actions/public-forms";
import { PublicFormClient } from "./PublicForm";
import { previewMetadata } from "@/lib/seo/previews";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	return previewMetadata("form", slug, "Form");
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const form = await getPublicForm(slug);

	// The form draws its own full page: theme, logo, background and layout.
	if (form && !form.unavailable) return <PublicFormClient form={form} />;

	return (
		<main className="flex min-h-[100dvh] items-center justify-center px-4 py-8" style={{ background: form?.background ?? "#f4f7f8" }}>
			<div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
				{!form ? (
					<>
						<h1 className="text-xl font-bold text-gray-900">This form is not available</h1>
						<p className="mt-2 text-gray-600">The link may be wrong, or the form has not been published yet.</p>
					</>
				) : (
					<>
						<h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
						<p className="mt-2 text-gray-600">{form.unavailable === "full" ? "This form has received all the responses it can take." : "This form is no longer accepting responses."}</p>
					</>
				)}
			</div>
		</main>
	);
}
