"use client";

import { FormRenderer } from "@/components/forms/FormRenderer";
import { submitFormResponse, type PublicForm } from "@/app/actions/public-forms";

export function PublicFormClient({ form }: { form: PublicForm }) {
	return <FormRenderer form={form} onSubmit={(answers, extra) => submitFormResponse(form.slug, answers, extra)} />;
}
