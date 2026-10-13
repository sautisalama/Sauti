"use client";

import { useParams } from "next/navigation";
import { FormBuilder } from "./_Builder";

export default function FormEditorPage() {
	const { id } = useParams<{ id: string }>();
	return <FormBuilder id={id} />;
}
