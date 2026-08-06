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
						<li>Call the national GBV hotline 1195 (available 24/7)</li>
						<li>Visit women&apos;s shelters or crisis centers</li>
						<li>
							File a confidential report on{" "}
							<a href="/report-abuse" className="underline font-semibold">
								sautisalama.org/report-abuse
							</a>
						</li>
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
						All services are free and confidential. Call us on{" "}
						<a href="tel:+254725668148" className="underline font-semibold">
							+254 725 668148
						</a>
						, email{" "}
						<a href="mailto:info@sautisalama.org" className="underline font-semibold">
							info@sautisalama.org
						</a>
						, or visit our centre at Lunga Lunga Square, Lunga Lunga Road, Industrial
						Area, Nairobi during business hours.
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
			<AccordionItem value="item-4">
				<AccordionTrigger className="text-left">
					Is Sauti Salama&apos;s support free?
				</AccordionTrigger>
				<AccordionContent>
					<p>
						Yes. Every service Sauti Salama offers — counselling, safe shelter
						referral, legal aid, safety planning and confidential reporting — is free
						of charge to survivors in Kenya.
					</p>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="item-5">
				<AccordionTrigger className="text-left">
					Where is Sauti Salama located?
				</AccordionTrigger>
				<AccordionContent>
					<p>
						Sauti Salama Safe Haven is based at Lunga Lunga Square, Lunga Lunga Road,
						Industrial Area, Makadara District, Nairobi, Kenya (P.O. Box 8786 - 00100,
						G.P.O. Nairobi). We serve survivors across Kenya in person, by phone on{" "}
						<a href="tel:+254725668148" className="underline font-semibold">
							+254 725 668148
						</a>
						, and online.
					</p>
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="item-6">
				<AccordionTrigger className="text-left">
					Can I report abuse anonymously?
				</AccordionTrigger>
				<AccordionContent>
					<p>
						Yes. Sauti Salama&apos;s platform supports fully anonymous reporting — you
						do not need to create an account or give your name to get matched with
						support. Reports are encrypted, and you control what is shared and with
						whom.
					</p>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
