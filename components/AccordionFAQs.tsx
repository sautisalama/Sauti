import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export function AccordionFAQs() {
	return (
		<Accordion type="single" collapsible className="w-full">
			<AccordionItem value="item-1">
				<AccordionTrigger className="text-left">
					How can I report an incident and what kind of help would I get
				</AccordionTrigger>
				<AccordionContent>
					<p>You can report GBV incidents through several channels:</p>
					<ul className="list-disc pl-6 space-y-1">
						<li>Contact local law enforcement</li>
						<li>Call national GBV hotlines (available 24/7)</li>
						<li>Visit women's shelters or crisis centers</li>
					</ul>
					<p className="mt-2">You can receive:</p>
					<ul className="list-disc pl-6 space-y-1">
						<li>Immediate safety planning and protection</li>
						<li>Medical care and counseling</li>
						<li>Legal support and advocacy</li>
						<li>Emergency shelter if needed</li>
						<li>Confidential support services</li>
					</ul>
					<p className="mt-2">
						All services prioritize your safety and confidentiality.
					</p>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="item-2">
				<AccordionTrigger className="text-left">
					What are some resources you offer and how can I access them?
				</AccordionTrigger>
				<AccordionContent>
					<p>We provide various resources including:</p>
					<ul className="list-disc pl-6 space-y-1">
						<li>24/7 crisis helpline</li>
						<li>Emergency shelter services</li>
						<li>Individual and group counseling</li>
						<li>Legal advocacy and court accompaniment</li>
						<li>Safety planning assistance</li>
						<li>Support groups</li>
						<li>Referrals to partner organizations</li>
					</ul>
					<p className="mt-2">
						All services are free and confidential. Contact us through our helpline or
						visit our center during business hours to access these resources.
					</p>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="item-3">
				<AccordionTrigger className="text-left">
					How can close people support those affected and impacted by GBV?
				</AccordionTrigger>
				<AccordionContent>
					<p>You can support survivors by:</p>
					<ul className="list-disc pl-6 space-y-1">
						<li>Listening without judgment</li>
						<li>Believing their story</li>
						<li>Respecting their privacy and confidentiality</li>
						<li>Helping them access professional support</li>
						<li>Learning about GBV to better understand their experience</li>
						<li>Being patient with their healing process</li>
						<li>Helping with practical needs (transportation, childcare)</li>
						<li>Continuing to provide support even after the immediate crisis</li>
					</ul>
					<p className="mt-2">
						Remember: Let them make their own decisions and maintain control over
						their situation.
					</p>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
