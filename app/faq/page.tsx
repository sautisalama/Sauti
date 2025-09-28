"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQ() {
	return (
		<>
			<Nav />
			<main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
				<div className="container mx-auto px-4 max-w-4xl">
					<div className="bg-white rounded-lg shadow-lg p-8">
						<h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
							Frequently Asked Questions
						</h1>
						
						<div className="space-y-6">
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="item-1">
									<AccordionTrigger className="text-left">
										What is Sauti Salama and how does it work?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Sauti Salama ("Safe Voice" in Swahili) is a survivor-led digital platform that connects Gender-Based Violence (GBV) survivors with verified professionals and support services. We use intelligent matching to connect you with counselors, lawyers, medical professionals, and social workers who can provide the specific support you need. The platform prioritizes your safety, privacy, and provides access to critical support services through secure communication channels.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-2">
									<AccordionTrigger className="text-left">
										Is my information safe and private on this platform?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Yes, your privacy and safety are our top priorities. We use end-to-end encryption for all communications, implement multiple security layers to protect your data, and allow you to use the platform completely anonymously if you choose. You have complete control over what information you share and with whom. We never sell or share your personal information without your explicit consent.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-3">
									<AccordionTrigger className="text-left">
										How do I get started on the platform?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Getting started is simple and designed to be as comfortable as possible. You can create an account with just a username - no personal details are required initially. You can share information gradually as you build trust with the platform. The registration process uses progressive disclosure, allowing you to begin with minimal information and add more details as needed.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-4">
									<AccordionTrigger className="text-left">
										What types of professionals are available on the platform?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										We have verified professionals including counselors, therapists, lawyers, medical professionals, social workers, and NGO partners. All professionals undergo rigorous verification including credential validation, license verification, and background screening. They specialize in various areas such as trauma-informed care, legal advocacy, medical support, and cultural competency.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-5">
									<AccordionTrigger className="text-left">
										How does the matching system work?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Our intelligent matching system considers multiple factors including the type of service needed (legal, medical, counseling), geographic accessibility, professional availability, urgency level, and your preferences for professional demographics, language requirements, and cultural background. The system continuously improves through feedback to ensure the best possible matches.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-6">
									<AccordionTrigger className="text-left">
										Can I use this platform anonymously?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Yes, you can use the platform completely anonymously. We offer multiple privacy options including disguised app functionality, panic logout features that instantly clear all session data, and quick exit options. You maintain complete control over your information sharing with granular privacy settings.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-7">
									<AccordionTrigger className="text-left">
										What if I need emergency help?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										If you are in immediate danger, please contact emergency services immediately:
										<div className="bg-red-50 border border-red-200 p-4 rounded-lg mt-4">
											<p className="text-red-800 font-semibold mb-2">Emergency Contacts:</p>
											<p className="text-red-700 mb-1">Police: 999</p>
											<p className="text-red-700 mb-1">GBV Hotline: 1195</p>
											<p className="text-red-700">Child Helpline: 116</p>
										</div>
										Our platform is not a substitute for emergency services, but we can help connect you with ongoing support and resources.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-8">
									<AccordionTrigger className="text-left">
										How much does it cost to use the platform?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										The core platform services are free to use. We connect you with both free and fee-based professional services based on your needs and circumstances. Some professionals may charge for their services, but we work to ensure you have access to both free and affordable options.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-9">
									<AccordionTrigger className="text-left">
										Can I report incidents and document evidence on the platform?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Yes, we provide comprehensive incident reporting tools that use trauma-informed design principles. You can document your experiences through text, voice recordings, photographs, and video evidence. All content is encrypted and timestamped, and you can save drafts to complete documentation at your own pace. You control what information you share and with whom.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-10">
									<AccordionTrigger className="text-left">
										Is there community support available?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Yes, we have moderated community spaces where you can connect with peers who share similar experiences. These communities are organized by various factors including type of violence experienced, demographic groups, geographic regions, and recovery stages. Trained moderators ensure safety and facilitate meaningful discussions.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-11">
									<AccordionTrigger className="text-left">
										How do I know the professionals are qualified?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										All professionals undergo rigorous verification including credential validation, license verification, and background screening. Professional profiles include detailed information about specializations, trauma-informed care training, cultural competencies, language abilities, and specific areas of expertise. We continuously monitor professional performance and response times.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-12">
									<AccordionTrigger className="text-left">
										Can I delete my account and data?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Yes, you have complete control over your data. You can delete your account and all associated data at any time. We also provide options to export your data if needed for legal proceedings. You can contact us to exercise your data rights including access, correction, and deletion.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-13">
									<AccordionTrigger className="text-left">
										What languages are supported on the platform?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										We support multiple languages to serve diverse communities across Kenya. Our professional matching considers language preferences and communication needs. The platform is designed to be culturally sensitive and accessible to users from different linguistic backgrounds.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-14">
									<AccordionTrigger className="text-left">
										How do I contact support if I have technical issues?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										You can contact our support team through the platform or by email at support@sautisalama.org. We respond to all inquiries within 48 hours. For urgent safety concerns, please use the emergency contacts provided above.
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="item-15">
									<AccordionTrigger className="text-left">
										Is the platform available on mobile devices?
									</AccordionTrigger>
									<AccordionContent className="text-gray-700 leading-relaxed">
										Yes, Sauti Salama is designed mobile-first and optimized for mobile devices. We recognize that most users access the platform through mobile devices, so all features are optimized for mobile use with offline capabilities for areas with limited internet connectivity.
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</div>

						<div className="mt-12 bg-blue-50 border border-blue-200 p-6 rounded-lg">
							<h3 className="text-xl font-semibold text-blue-900 mb-4">Still have questions?</h3>
							<p className="text-blue-800 mb-4">
								If you don't see your question answered here, please don't hesitate to contact us. We're here to help and support you.
							</p>
							<div className="space-y-2">
								<p className="text-blue-700"><strong>Email:</strong> support@sautisalama.org</p>
								<p className="text-blue-700"><strong>Response Time:</strong> Within 48 hours</p>
								<p className="text-blue-700"><strong>Emergency:</strong> Use emergency contacts above for immediate danger</p>
							</div>
						</div>
					</div>
				</div>
			</main>
			<Footer />
		</>
	);
}
