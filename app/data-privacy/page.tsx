"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function DataPrivacy() {
	return (
		<>
			<Nav />
			<main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
				<div className="container mx-auto px-4 max-w-4xl">
					<div className="bg-white rounded-lg shadow-lg p-8">
						<h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
							Data Privacy Statement
						</h1>
						
						<div className="prose prose-lg max-w-none">
							<p className="text-gray-600 mb-6 text-center">
								<strong>Last Updated:</strong> {new Date().toLocaleDateString()}
							</p>

							<div className="space-y-8">
								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Our Commitment to Your Privacy</h2>
									<p className="text-gray-700 leading-relaxed">
										At Sauti Salama, we understand that your privacy and safety are paramount. This Data Privacy Statement outlines our commitment to protecting your personal information and explains how we handle your data with the highest standards of security and confidentiality.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Key Privacy Principles</h2>
									
									<div className="grid md:grid-cols-2 gap-6 mb-8">
										<div className="bg-green-50 border border-green-200 p-6 rounded-lg">
											<h3 className="text-lg font-semibold text-green-800 mb-3">🔒 Data Minimization</h3>
											<p className="text-green-700">
												We collect only the information necessary to provide our services and never more than you choose to share.
											</p>
										</div>
										
										<div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
											<h3 className="text-lg font-semibold text-blue-800 mb-3">🛡️ End-to-End Encryption</h3>
											<p className="text-blue-700">
												All communications and sensitive data are protected with industry-standard encryption.
											</p>
										</div>
										
										<div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
											<h3 className="text-lg font-semibold text-purple-800 mb-3">👤 User Control</h3>
											<p className="text-purple-700">
												You have complete control over your data and can delete or export it at any time.
											</p>
										</div>
										
										<div className="bg-orange-50 border border-orange-200 p-6 rounded-lg">
											<h3 className="text-lg font-semibold text-orange-800 mb-3">🚫 No Data Selling</h3>
											<p className="text-orange-700">
												We never sell, trade, or rent your personal information to third parties.
											</p>
										</div>
									</div>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">How We Protect Your Data</h2>
									
									<h3 className="text-xl font-medium text-gray-700 mb-3">Technical Safeguards</h3>
									<ul className="list-disc pl-6 text-gray-700 space-y-2 mb-6">
										<li><strong>Encryption:</strong> All data is encrypted both in transit and at rest using AES-256 encryption</li>
										<li><strong>Secure Infrastructure:</strong> Our servers are hosted on secure, certified cloud infrastructure</li>
										<li><strong>Access Controls:</strong> Strict access controls ensure only authorized personnel can access data</li>
										<li><strong>Regular Audits:</strong> We conduct regular security audits and vulnerability assessments</li>
										<li><strong>Data Backup:</strong> Secure, encrypted backups protect against data loss</li>
									</ul>

									<h3 className="text-xl font-medium text-gray-700 mb-3">Operational Safeguards</h3>
									<ul className="list-disc pl-6 text-gray-700 space-y-2">
										<li><strong>Staff Training:</strong> All team members undergo privacy and security training</li>
										<li><strong>Data Access Logs:</strong> We maintain detailed logs of all data access and modifications</li>
										<li><strong>Incident Response:</strong> Comprehensive incident response procedures for any security issues</li>
										<li><strong>Regular Reviews:</strong> Regular review and update of our privacy practices</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Data Rights</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										You have comprehensive rights regarding your personal data:
									</p>
									
									<div className="grid md:grid-cols-2 gap-4">
										<div className="bg-gray-50 p-4 rounded-lg">
											<h4 className="font-semibold text-gray-800 mb-2">Right to Access</h4>
											<p className="text-gray-600 text-sm">Request a copy of all personal data we hold about you</p>
										</div>
										
										<div className="bg-gray-50 p-4 rounded-lg">
											<h4 className="font-semibold text-gray-800 mb-2">Right to Rectification</h4>
											<p className="text-gray-600 text-sm">Correct any inaccurate or incomplete information</p>
										</div>
										
										<div className="bg-gray-50 p-4 rounded-lg">
											<h4 className="font-semibold text-gray-800 mb-2">Right to Erasure</h4>
											<p className="text-gray-600 text-sm">Request deletion of your personal data</p>
										</div>
										
										<div className="bg-gray-50 p-4 rounded-lg">
											<h4 className="font-semibold text-gray-800 mb-2">Right to Portability</h4>
											<p className="text-gray-600 text-sm">Export your data in a machine-readable format</p>
										</div>
										
										<div className="bg-gray-50 p-4 rounded-lg">
											<h4 className="font-semibold text-gray-800 mb-2">Right to Restriction</h4>
											<p className="text-gray-600 text-sm">Limit how we process your data</p>
										</div>
										
										<div className="bg-gray-50 p-4 rounded-lg">
											<h4 className="font-semibold text-gray-800 mb-2">Right to Object</h4>
											<p className="text-gray-600 text-sm">Object to certain types of data processing</p>
										</div>
									</div>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Data Retention Policy</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We retain your data only for as long as necessary:
									</p>
									
									<div className="overflow-x-auto">
										<table className="w-full border-collapse border border-gray-300">
											<thead>
												<tr className="bg-gray-100">
													<th className="border border-gray-300 px-4 py-2 text-left">Data Type</th>
													<th className="border border-gray-300 px-4 py-2 text-left">Retention Period</th>
													<th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
												</tr>
											</thead>
											<tbody>
												<tr>
													<td className="border border-gray-300 px-4 py-2">Account Information</td>
													<td className="border border-gray-300 px-4 py-2">Until account deletion</td>
													<td className="border border-gray-300 px-4 py-2">Service provision</td>
												</tr>
												<tr>
													<td className="border border-gray-300 px-4 py-2">Incident Reports</td>
													<td className="border border-gray-300 px-4 py-2">As needed for legal/safety purposes</td>
													<td className="border border-gray-300 px-4 py-2">Support services</td>
												</tr>
												<tr>
													<td className="border border-gray-300 px-4 py-2">Communication Records</td>
													<td className="border border-gray-300 px-4 py-2">Duration of service use</td>
													<td className="border border-gray-300 px-4 py-2">Service continuity</td>
												</tr>
												<tr>
													<td className="border border-gray-300 px-4 py-2">Technical Logs</td>
													<td className="border border-gray-300 px-4 py-2">Up to 2 years</td>
													<td className="border border-gray-300 px-4 py-2">Security and analytics</td>
												</tr>
											</tbody>
										</table>
									</div>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Third-Party Services</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										We may use trusted third-party services to provide our platform. These services are carefully selected and bound by strict confidentiality agreements:
									</p>
									<ul className="list-disc pl-6 text-gray-700 space-y-2">
										<li>Cloud hosting services with security certifications</li>
										<li>Encrypted communication services</li>
										<li>Analytics services (anonymized data only)</li>
										<li>Payment processing (if applicable)</li>
									</ul>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">International Data Transfers</h2>
									<p className="text-gray-700 leading-relaxed">
										If your data is transferred outside Kenya, we ensure appropriate safeguards are in place, including standard contractual clauses and adequacy decisions, to protect your information in accordance with applicable data protection laws.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Updates to This Statement</h2>
									<p className="text-gray-700 leading-relaxed">
										We may update this Data Privacy Statement from time to time to reflect changes in our practices or applicable laws. We will notify you of any material changes and post the updated statement on our website with a new "Last Updated" date.
									</p>
								</section>

								<section>
									<h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Us About Privacy</h2>
									<p className="text-gray-700 leading-relaxed mb-4">
										If you have any questions about this Data Privacy Statement or our privacy practices, please contact us:
									</p>
									<div className="bg-gray-50 p-6 rounded-lg">
										<p className="text-gray-700 mb-2"><strong>Privacy Officer:</strong> privacy@sautisalama.org</p>
										<p className="text-gray-700 mb-2"><strong>Data Protection Officer:</strong> dpo@sautisalama.org</p>
										<p className="text-gray-700 mb-2"><strong>General Inquiries:</strong> info@sautisalama.org</p>
										<p className="text-gray-700"><strong>Response Time:</strong> We respond to all privacy inquiries within 48 hours</p>
									</div>
								</section>

								<section className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
									<h2 className="text-2xl font-semibold text-blue-900 mb-4">Your Privacy Matters</h2>
									<p className="text-blue-800 leading-relaxed">
										We are committed to maintaining the highest standards of privacy and data protection. Your trust is essential to our mission of providing safe, confidential support services. If you have any concerns about how we handle your data, please don't hesitate to contact us.
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
