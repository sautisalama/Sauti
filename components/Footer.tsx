import Link from "next/link";

export function Footer() {
	return (
		<div className="flex flex-col md:flex-row items-start justify-between max-w-[60%] m-auto pb-20 border-landing border-b">
			<ul className="flex flex-col gap-2 text-landing">
				<li className="text-base font-bold pb-2 md:pb-4">Professional Services</li>
				<li className="text-xs">Legal</li>
				<li className="text-xs">Therapist</li>
				<li className="text-xs">Counsellors</li>
				<li className="text-xs">Psychiatrist</li>
			</ul>
			<ul className="flex flex-col gap-2 text-landing mt-8 md:mt-0">
				<li className="text-base font-bold pb-2 md:pb-4">Legal & Privacy</li>
				<li className="text-xs">
					<Link href="/privacy-policy" className="hover:text-sauti-orange transition-colors">
						Privacy Policy
					</Link>
				</li>
				<li className="text-xs">
					<Link href="/terms-conditions" className="hover:text-sauti-orange transition-colors">
						Terms & Conditions
					</Link>
				</li>
				<li className="text-xs">
					<Link href="/data-privacy" className="hover:text-sauti-orange transition-colors">
						Data Privacy Statement
					</Link>
				</li>
				<li className="text-xs">
					<Link href="/faq" className="hover:text-sauti-orange transition-colors">
						Frequently Asked Questions
					</Link>
				</li>
			</ul>
			<ul className="flex flex-col gap-2 text-landing mt-8 md:mt-0">
				<li className="text-base font-bold pb-2 md:pb-4">Contact us</li>
				<li className="text-xs">support@sautisalama.org</li>
				<li className="text-xs">privacy@sautisalama.org</li>
				<li className="text-xs">Emergency: 999</li>
				<li className="text-xs">GBV Hotline: 1195</li>
			</ul>
		</div>
	);
}
