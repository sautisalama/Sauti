"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function DataPrivacy() {
	return (
		<>
			<Nav />
			<main className="min-h-screen bg-white py-12 md:py-24 lg:py-32 font-serif">
				<div className="container mx-auto px-4 max-w-4xl">
					<div className="text-left mb-12 md:mb-20">
						<h1 className="text-3xl md:text-5xl lg:text-7xl font-bold text-sauti-blue mb-8">
							Data Privacy Statement
						</h1>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                            Last Updated: {new Date().toLocaleDateString()}
                        </p>
					</div>

                    <div className="space-y-12 md:space-y-16">
                        <section>
                            <h2 className="text-2xl md:text-3xl font-bold text-sauti-blue mb-4 md:mb-6">Our Commitment</h2>
                            <p className="text-gray-600 text-lg md:text-xl leading-relaxed">
                                At Sauti, we understand that your privacy and safety are paramount. This Data Privacy Statement outlines our commitment to protecting your personal information.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl md:text-3xl font-bold text-sauti-blue mb-8">Key principles</h2>
                            <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                                <div className="bg-orange-50 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-orange-100">
                                    <h3 className="text-xl font-bold text-sauti-orange mb-3">Data Minimization</h3>
                                    <p className="text-gray-700">We collect only the information necessary for your safety and care.</p>
                                </div>
                                <div className="bg-sauti-blue/5 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-sauti-blue/10">
                                    <h3 className="text-xl font-bold text-sauti-blue mb-3">Encryption</h3>
                                    <p className="text-gray-700">All sensitive data is protected with industry-standard encryption.</p>
                                </div>
                                <div className="bg-green-50 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-green-100">
                                    <h3 className="text-xl font-bold text-green-700 mb-3">User Control</h3>
                                    <p className="text-gray-700">You have complete control over your data at all times.</p>
                                </div>
                                <div className="bg-gray-50 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100">
                                    <h3 className="text-xl font-bold text-gray-800 mb-3">No Data Selling</h3>
                                    <p className="text-gray-700">We never sell, trade, or rent your personal information.</p>
                                </div>
                            </div>
                        </section>

                        <section className="bg-sauti-blue rounded-[32px] md:rounded-[48px] p-8 md:p-12 text-white">
                            <h2 className="text-2xl md:text-4xl font-bold mb-6">Privacy Support</h2>
                            <p className="text-lg md:text-xl text-white/70 mb-8 leading-relaxed">
                                If you have any questions about our privacy statement, please contact us.
                            </p>
                            <div className="space-y-4">
                                <p><strong>Privacy Officer:</strong> privacy@sautisalama.org</p>
                                <p><strong>Response Time:</strong> Within 48 hours</p>
                            </div>
                        </section>
                    </div>
				</div>
			</main>
			<Footer />
		</>
	);
}
