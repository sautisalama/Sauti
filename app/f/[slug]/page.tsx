import { getPublicForm } from "@/app/actions/public-forms";
import { PublicFormClient } from "./PublicForm";

export const metadata = { title: "Form", robots: { index: false, follow: false } };

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const form = await getPublicForm(slug);

	return (
		<main className="min-h-[100dvh] bg-purple-50/60 px-4 py-8 sm:py-12">
			<div className="mx-auto w-full max-w-2xl">
				{!form ? (
					<div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
						<h1 className="text-xl font-bold text-gray-900">This form is not available</h1>
						<p className="mt-2 text-gray-600">The link may be wrong, or the form has not been published yet.</p>
					</div>
				) : form.unavailable ? (
					<div className="rounded-2xl border border-gray-200 border-t-8 border-t-purple-600 bg-white p-8 text-center shadow-sm">
						<h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
						<p className="mt-2 text-gray-600">
							{form.unavailable === "full" ? "This form has received all the responses it can take." : "This form is no longer accepting responses."}
						</p>
					</div>
				) : (
					<PublicFormClient form={form} />
				)}
				<p className="mt-8 text-center text-xs text-gray-400">Sauti Salama · Please do not share passwords or card numbers in forms.</p>
			</div>
		</main>
	);
}
