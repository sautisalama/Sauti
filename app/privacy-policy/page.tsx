import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicy() {
	return (
		<>
			<Nav />
			<main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
				<div className="container mx-auto px-4 max-w-4xl">
					<div className="bg-white rounded-lg shadow-lg p-8">
						<h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
							Privacy Policy
						</h1>
						
						<div className="prose prose-lg max-w-none">
							<p className="text-gray-600 mb-6 text-center">
								<strong>Last Updated:</strong> {new Date().toLocaleDateString()}
							</p>

							<div className="space-y-8">
								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
									<p className="text-gray-700 leading-relaxed">
										Welcome to Sauti Salama ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, which connects Gender-Based Violence (GBV) survivors with verified professionals and support services.
									</p>
									<p className="text-gray-700 leading-relaxed mt-4">
										Your privacy and safety are our top priorities. We understand the sensitive nature of the information you may share with us, and we have implemented robust security measures to protect your data and maintain your anonymity when desired.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>
									
									<h3 className="text-xl font-medium text-gray-700 mb-3">2.1 Personal Information</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										We collect only the information you choose to provide, which may include:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Contact information (email address, phone number) - only when you choose to provide it</li>
										<li>Username or display name (can be anonymous)</li>
										<li>Location information (only if you choose to share it for service matching)</li>
										<li>Demographic information (age range, preferred language) - optional</li>
										<li>Professional credentials (for verified professionals only)</li>
									</ul>

									<h3 className="text-xl font-medium text-gray-700 mb-3">2.2 Sensitive Information</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										With your explicit consent, we may collect sensitive information including:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Incident reports and documentation</li>
										<li>Audio recordings and voice messages</li>
										<li>Images and video content (when you choose to upload them)</li>
										<li>Health and mental health information</li>
										<li>Legal case information</li>
									</ul>

									<h3 className="text-xl font-medium text-gray-700 mb-3">2.3 Technical Information</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										We automatically collect certain technical information to ensure platform security and functionality:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2">
										<li>Device information (type, operating system, browser)</li>
										<li>IP address and general location data</li>
										<li>Usage patterns and platform interactions</li>
										<li>Security logs and access records</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">3. How We Use Your Information</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We use your information solely to provide and improve our services:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Connect you with appropriate professionals and support services</li>
										<li>Facilitate secure communication between users and professionals</li>
										<li>Provide personalized safety planning and resource recommendations</li>
										<li>Maintain platform security and prevent abuse</li>
										<li>Improve our services through anonymous analytics</li>
										<li>Comply with legal obligations and protect user safety</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Information Sharing and Disclosure</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We are committed to protecting your privacy. We do not sell, trade, or rent your personal information to third parties. We may share information only in the following limited circumstances:
									</p>
									
									<h3 className="text-xl font-medium text-gray-700 mb-3">4.1 With Your Consent</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										We may share information with professionals or organizations only when you explicitly consent to such sharing.
									</p>

									<h3 className="text-xl font-medium text-gray-700 mb-3">4.2 Safety and Legal Requirements</h3>
									<p className="text-gray-700 leading-relaxed mb-4">
										We may disclose information if required by law or if we believe it is necessary to:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Protect your safety or the safety of others</li>
										<li>Comply with legal processes or court orders</li>
										<li>Prevent fraud or abuse of our platform</li>
										<li>Respond to emergency situations</li>
									</ul>

									<h3 className="text-xl font-medium text-gray-700 mb-3">4.3 Service Providers</h3>
									<p className="text-gray-700 leading-relaxed">
										We may share information with trusted service providers who assist us in operating our platform, subject to strict confidentiality agreements.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Data Security and Protection</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We implement industry-standard security measures to protect your information:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>End-to-end encryption for all communications</li>
										<li>Secure data storage with encryption at rest</li>
										<li>Regular security audits and vulnerability assessments</li>
										<li>Access controls and authentication protocols</li>
										<li>Secure data transmission using HTTPS/TLS</li>
									</ul>
									<p className="text-gray-700 leading-relaxed">
										Despite our security measures, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security but are committed to protecting your information to the best of our ability.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Your Rights and Choices</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										You have the following rights regarding your personal information:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
										<li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
										<li><strong>Deletion:</strong> Request deletion of your personal information</li>
										<li><strong>Portability:</strong> Request transfer of your data to another service</li>
										<li><strong>Restriction:</strong> Request limitation of how we process your information</li>
										<li><strong>Objection:</strong> Object to certain types of processing</li>
									</ul>
									<p className="text-gray-700 leading-relaxed">
										To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Data Retention</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We retain your personal information only for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy. Specifically:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
										<li>Account information: Until you delete your account or request deletion</li>
										<li>Incident reports: As long as needed for legal or safety purposes</li>
										<li>Communication records: For the duration of your use of our services</li>
										<li>Technical logs: Up to 2 years for security and analytics purposes</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">8. International Data Transfers</h2>
									<p className="text-gray-700 leading-relaxed">
										Your information may be transferred to and processed in countries other than your country of residence. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards to protect your information.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Children's Privacy</h2>
									<p className="text-gray-700 leading-relaxed">
										Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Changes to This Privacy Policy</h2>
									<p className="text-gray-700 leading-relaxed">
										We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically for any changes.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Contact Us</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										If you have any questions about this Privacy Policy or our privacy practices, please contact us:
									</p>
									<div className="bg-gray-50 p-6 rounded-lg">
										<p className="text-gray-700 mb-2"><strong>Email:</strong> privacy@sautisalama.org</p>
										<p className="text-gray-700 mb-2"><strong>Address:</strong> Sauti Salama Privacy Team</p>
										<p className="text-gray-700 mb-2"><strong>Response Time:</strong> We will respond to your inquiry within 48 hours</p>
									</div>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Emergency Situations</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										If you are in immediate danger, please contact emergency services immediately:
									</p>
									<div className="bg-red-50 border border-red-200 p-6 rounded-lg">
										<p className="text-red-800 font-semibold mb-2">Emergency Contacts:</p>
										<p className="text-red-700 mb-1">Police: 999</p>
										<p className="text-red-700 mb-1">GBV Hotline: 1195</p>
										<p className="text-red-700">Child Helpline: 116</p>
									</div>
								</section>
							</div>
						</div>
					</div>
				</div>
			</main>
			<Footer />
		</>
	);
}
