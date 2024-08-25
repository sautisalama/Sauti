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
				<li className="text-base font-bold pb-2 md:pb-4">More</li>
				<li className="text-xs">Terms & Conditions</li>
				<li className="text-xs">Data Privacy Statement</li>
				<li className="text-xs">Frequently Asked Questions</li>
			</ul>
			<ul className="flex flex-col gap-2 text-landing mt-8 md:mt-0">
				<li className="text-base font-bold pb-2 md:pb-4">Contact us</li>
				<li className="text-xs">Terms & Conditions</li>
				<li className="text-xs">Data Privacy Statement</li>
				<li className="text-xs">Frequently Asked Questions</li>
			</ul>
		</div>
	);
}
