"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function TermsConditions() {
	return (
		<>
			<Nav />
			<main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
				<div className="container mx-auto px-4 max-w-4xl">
					<div className="bg-white rounded-lg shadow-lg p-8">
						<h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
							Terms and Conditions
						</h1>
						
						<div className="prose prose-lg max-w-none">
							<p className="text-gray-600 mb-6 text-center">
								<strong>Last Updated:</strong> {new Date().toLocaleDateString()}
							</p>

							<div className="space-y-8">
								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Acceptance of Terms</h2>
									<p className="text-gray-700 leading-relaxed">
										By accessing and using Sauti Salama ("the Platform," "our Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Description of Service</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										Sauti Salama is a digital platform that connects Gender-Based Violence (GBV) survivors with verified professionals and support services. Our services include:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2">
										<li>Professional matching and connection services</li>
										<li>Secure communication platforms</li>
										<li>Resource sharing and educational content</li>
										<li>Community support spaces</li>
										<li>Incident reporting and documentation tools</li>
										<li>Safety planning resources</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">3. User Eligibility</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										To use our services, you must:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Be at least 18 years of age</li>
										<li>Provide accurate and truthful information</li>
										<li>Comply with all applicable laws and regulations</li>
										<li>Respect the rights and privacy of other users</li>
									</ul>
									<p className="text-gray-700 leading-relaxed">
										For professionals, additional verification requirements apply, including credential validation and background screening.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">4. User Responsibilities</h2>
									
									<h3 className="text-xl font-medium text-gray-700 mb-3">4.1 General Conduct</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										Users agree to:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Use the platform only for lawful purposes</li>
										<li>Respect the privacy and confidentiality of other users</li>
										<li>Not share false, misleading, or harmful information</li>
										<li>Not engage in harassment, abuse, or threatening behavior</li>
										<li>Not attempt to circumvent platform security measures</li>
									</ul>

									<h3 className="text-xl font-medium text-gray-700 mb-3">4.2 Professional Standards</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										Verified professionals must:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2">
										<li>Maintain current professional credentials</li>
										<li>Adhere to professional ethical standards</li>
										<li>Provide accurate information about their qualifications</li>
										<li>Respond to user inquiries in a timely manner</li>
										<li>Maintain confidentiality of user information</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Privacy and Data Protection</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										Your privacy is our priority. Our collection, use, and protection of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.
									</p>
									<p className="text-gray-700 leading-relaxed">
										By using our services, you consent to the collection and use of information as described in our Privacy Policy.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Prohibited Uses</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										You may not use our platform:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
										<li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
										<li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
										<li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
										<li>To submit false or misleading information</li>
										<li>To upload or transmit viruses or any other type of malicious code</li>
										<li>To spam, phish, pharm, pretext, spider, crawl, or scrape</li>
										<li>For any obscene or immoral purpose</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Content and Intellectual Property</h2>
									
									<h3 className="text-xl font-medium text-gray-700 mb-3">7.1 User Content</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										You retain ownership of content you create and share on our platform. However, by sharing content, you grant us a limited, non-exclusive license to use, display, and distribute such content as necessary to provide our services.
									</p>

									<h3 className="text-xl font-medium text-gray-700 mb-3">7.2 Platform Content</h3>
									<p className="text-gray-700 leading-relaxed">
										All content, features, and functionality of our platform are owned by Sauti Salama and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Disclaimers and Limitations of Liability</h2>
									
									<h3 className="text-xl font-medium text-gray-700 mb-3">8.1 Service Disclaimer</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										Our platform is provided "as is" and "as available." We make no representations or warranties of any kind, express or implied, regarding the use or results of our platform in terms of correctness, accuracy, reliability, or otherwise.
									</p>

									<h3 className="text-xl font-medium text-gray-700 mb-3">8.2 Professional Services</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										We facilitate connections between users and professionals but do not provide professional services directly. We are not responsible for the quality, accuracy, or outcomes of services provided by professionals on our platform.
									</p>

									<h3 className="text-xl font-medium text-gray-700 mb-3">8.3 Limitation of Liability</h3>
									<p className="text-gray-700 leading-relaxed">
										To the fullest extent permitted by law, Sauti Salama shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of our platform.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Emergency Situations</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										Our platform is not a substitute for emergency services. If you are in immediate danger, please contact emergency services immediately:
									</p>
									<div className="bg-red-50 border border-red-200 p-6 rounded-lg mb-4">
										<p className="text-red-800 font-semibold mb-2">Emergency Contacts:</p>
										<p className="text-red-700 mb-1">Police: 999</p>
										<p className="text-red-700 mb-1">GBV Hotline: 1195</p>
										<p className="text-red-700">Child Helpline: 116</p>
									</div>
									<p className="text-gray-700 leading-relaxed">
										We are not responsible for emergency response or crisis intervention services.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Account Termination</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
									</p>
									<p className="text-gray-700 leading-relaxed">
										Upon termination, your right to use the platform will cease immediately. You may also terminate your account at any time by contacting us.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Governing Law</h2>
									<p className="text-gray-700 leading-relaxed">
										These Terms shall be interpreted and governed by the laws of Kenya, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Changes to Terms</h2>
									<p className="text-gray-700 leading-relaxed">
										We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">13. Contact Information</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										If you have any questions about these Terms and Conditions, please contact us:
									</p>
									<div className="bg-gray-50 p-6 rounded-lg">
										<p className="text-gray-700 mb-2"><strong>Email:</strong> legal@sautisalama.org</p>
										<p className="text-gray-700 mb-2"><strong>Address:</strong> Sauti Salama Legal Team</p>
										<p className="text-gray-700"><strong>Response Time:</strong> We will respond to your inquiry within 48 hours</p>
									</div>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">14. Severability</h2>
									<p className="text-gray-700 leading-relaxed">
										If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
									</p>
								</section>
							</div>
						</div>
					</div>
				</div>
			</main>
			<div className="bg-sauti-black py-10">
				<Footer />
			</div>
		</>
	);
}
