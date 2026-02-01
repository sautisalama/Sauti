"use client";

import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog";
import ContactForm from "./ContactForm";

interface ContactModalProps {
    trigger: React.ReactNode;
    title?: string;
    description?: string;
}

export default function ContactModal({ trigger, title, description }: ContactModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px]">
                <ContactForm title={title} description={description} />
            </DialogContent>
        </Dialog>
    );
}
