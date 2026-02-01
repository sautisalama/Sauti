"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQ() {
	return (
		<>
			<Nav />
			<main className="min-h-screen bg-white py-12 md:py-24 lg:py-32 font-serif">
				<div className="container mx-auto px-4 max-w-4xl">
					<div className="text-left mb-12 md:mb-20">
                        <div className="inline-block rounded-full px-4 py-1 text-xs md:text-sm font-bold bg-sauti-blue/10 text-sauti-blue mb-4 md:mb-6 uppercase tracking-wider">
                            Global Support
                        </div>
						<h1 className="text-3xl md:text-5xl lg:text-7xl font-bold text-sauti-blue mb-8">
							Frequently Asked Questions
						</h1>
					</div>

					<div className="space-y-4 md:space-y-6">
						<Accordion type="single" collapsible className="w-full space-y-4">
							<AccordionItem value="item-1" className="border border-gray-100 rounded-[24px] md:rounded-[32px] px-6 md:px-8 bg-gray-50 shadow-sm overflow-hidden">
								<AccordionTrigger className="text-lg md:text-2xl font-bold text-sauti-blue hover:no-underline hover:text-sauti-orange transition-colors text-left py-6">
									What is Sauti and how does it work?
								</AccordionTrigger>
								<AccordionContent className="text-base md:text-lg text-gray-600 leading-relaxed pb-8">
									Sauti is a survivor-led digital platform that connects Gender-Based Violence (GBV) survivors with verified professionals and support services. We prioritize your safety, privacy, and provide access to critical support services through secure communication channels.
								</AccordionContent>
							</AccordionItem>

							<AccordionItem value="item-2" className="border border-gray-100 rounded-[24px] md:rounded-[32px] px-6 md:px-8 bg-gray-50 shadow-sm overflow-hidden">
								<AccordionTrigger className="text-lg md:text-2xl font-bold text-sauti-blue hover:no-underline hover:text-sauti-orange transition-colors text-left py-6">
									Is my information safe and private?
								</AccordionTrigger>
								<AccordionContent className="text-base md:text-lg text-gray-600 leading-relaxed pb-8">
									Yes, your privacy and safety are our top priorities. We use end-to-end encryption for all communications and allow you to use the platform completely anonymously if you choose.
								</AccordionContent>
							</AccordionItem>

							<AccordionItem value="item-3" className="border border-gray-100 rounded-[24px] md:rounded-[32px] px-6 md:px-8 bg-gray-50 shadow-sm overflow-hidden">
								<AccordionTrigger className="text-lg md:text-2xl font-bold text-sauti-blue hover:no-underline hover:text-sauti-orange transition-colors text-left py-6">
									How do I get started?
								</AccordionTrigger>
								<AccordionContent className="text-base md:text-lg text-gray-600 leading-relaxed pb-8">
									Getting started is simple. You can create an account with just a username - no personal details are required initially.
								</AccordionContent>
							</AccordionItem>

							<AccordionItem value="item-7" className="border border-red-100 rounded-[24px] md:rounded-[32px] px-6 md:px-8 bg-red-50/50 shadow-sm overflow-hidden">
								<AccordionTrigger className="text-lg md:text-2xl font-bold text-red-900 hover:no-underline transition-colors text-left py-6">
									What if I need emergency help?
								</AccordionTrigger>
								<AccordionContent className="text-base md:text-lg text-red-800 leading-relaxed pb-8">
									If you are in immediate danger, please contact emergency services immediately:
									<div className="bg-white border border-red-200 p-6 rounded-2xl mt-4 space-y-2">
										<p className="font-black text-red-900">Emergency Contacts:</p>
										<p>Police: <strong>999</strong></p>
										<p>GBV Hotline: <strong>1195</strong></p>
										<p>Child Helpline: <strong>116</strong></p>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</div>

					<div className="mt-12 md:mt-24 bg-sauti-blue rounded-[32px] md:rounded-[48px] p-8 md:p-12 text-white">
						<h3 className="text-2xl md:text-4xl font-bold mb-6">Still have questions?</h3>
						<p className="text-lg md:text-xl text-white/70 mb-8 leading-relaxed">
							If you don't see your question answered here, please don't hesitate to contact us.
						</p>
						<div className="space-y-4">
							<p className="text-white"><strong>Email:</strong> support@sautisalama.org</p>
							<p className="text-white"><strong>Response Time:</strong> Within 48 hours</p>
						</div>
					</div>
				</div>
			</main>
			<Footer />
		</>
	);
}
