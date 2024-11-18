"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import AddSupportServiceForm from "./AddSupportServiceForm";

export default function AddSupportServiceButton({
	userId,
}: {
	userId: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>Add Support Service</Button>
			</DialogTrigger>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<AddSupportServiceForm onClose={() => setOpen(false)} userId={userId} />
			</DialogContent>
		</Dialog>
	);
}
