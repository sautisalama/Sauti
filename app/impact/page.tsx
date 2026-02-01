"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

export default function ImpactPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main className="flex-1">
				<section className="py-12 md:py-24 lg:py-32 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-6 items-stretch">
							{/* Left Column */}
							<div className="flex flex-col gap-6">
								<div className="bg-sauti-blue rounded-[32px] md:rounded-[40px] px-6 py-12 md:p-16 flex flex-col justify-center flex-1 min-h-[400px] md:min-h-[500px] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#ebc13d]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
									<span className="relative z-10 inline-flex w-fit px-4 py-1.5 md:py-2 rounded-full bg-sauti-orange text-sauti-blue text-[10px] md:text-sm font-bold mb-6 md:mb-8 uppercase tracking-wider">
										Measured in Lives Changed
									</span>
									<h1 className="relative z-10 font-serif text-3xl md:text-5xl lg:text-7xl font-black text-white leading-tight mb-6 md:mb-8">
										Impact that matters to Survivors.
									</h1>
									<p className="relative z-10 text-white/80 text-lg md:text-2xl leading-relaxed mb-8 md:mb-10 max-w-2xl font-medium font-serif">
                                        Accountability is our core metric. We track not just numbers, but the tangible shifts in safety and community resilience.
									</p>
								</div>
							</div>

							{/* Right Column - Image */}
							<div className="bg-[#f2f1ef] rounded-[32px] md:rounded-[40px] overflow-hidden relative min-h-[300px] md:min-h-[500px]">
								<Image
									src="/events/impact/at cop30.png"
									alt="Strategic Impact"
									fill
									className="object-cover grayscale contrast-125"
								/>
                                <div className="absolute inset-0 bg-gradient-to-t from-sauti-blue/40 to-transparent" />
							</div>
						</div>
					</div>
				</section>

                {/* Core Stats */}
                <section className="py-12 md:py-24 relative z-20">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="bg-white rounded-[32px] md:rounded-[60px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] p-8 md:p-16 lg:p-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-16 border border-gray-50">
                              <StatBlock value="500+" label="Survivors Reached" />
                              <StatBlock value="1000+" label="Educated" />
                              <StatBlock value="95%" label="Impact" />
                              <StatBlock value="10+" label="Programs" />
                        </div>
                    </div>
                </section>

                {/* Narrative Impact */}
				<section className="py-12 md:py-20 bg-white">
					<div className="container px-4 max-w-7xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center mb-24 md:mb-40">
                            <div>
                                <h2 className="text-3xl md:text-5xl lg:text-7xl font-bold text-sauti-blue mb-6 md:mb-10 leading-tight">
                                    Accountability.
                                </h2>
                                <p className="text-lg md:text-2xl text-gray-600 leading-relaxed font-light mb-8 md:mb-12">
                                    We believe in learning as part of accountability. Alongside progress, we reflect on challenges and systemic gaps ensuring our work remains responsive.
                                </p>
                                <div className="grid gap-4 md:gap-8 border-l-4 border-sauti-orange/20 pl-4 md:pl-8">
                                    <ImpactRow title="Policy Influence" description="Survivor-led evidence to 3 national frameworks." />
                                    <ImpactRow title="Digital Safety" description="Secured data for 50+ grassroots orgs." />
                                    <ImpactRow title="Climate Resilience" description="Built 5 'Circles of Safety' spaces." />
                                </div>
                            </div>
                            <div className="relative">
                                <div className="rounded-tl-[80px] md:rounded-tl-[150px] rounded-br-[80px] md:rounded-br-[150px] rounded-tr-[32px] md:rounded-tr-[40px] rounded-bl-[32px] md:rounded-bl-[40px] overflow-hidden shadow-3xl aspect-[3/4] relative group">
                                    <Image 
                                        src="/events/impact/at cop30.png" 
                                        alt="Sauti at COP30" 
                                        fill 
                                        className="object-cover group-hover:scale-105 transition-transform duration-700" 
                                    />
                                </div>
                                <div className="absolute -bottom-6 md:-bottom-10 -left-6 md:-left-10 bg-[#ebc13d] text-[#00473e] p-6 md:p-10 rounded-[24px] md:rounded-[40px] shadow-2xl max-w-xs z-10 transition-all">
                                     <div className="text-2xl md:text-4xl font-black mb-1 md:mb-2">COP30</div>
                                     <p className="font-bold leading-tight uppercase tracking-widest text-[10px] md:text-sm text-[#00473e]/70">Global Climate Action Leadership</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center mb-12 md:mb-32 py-12 md:py-24 border-t border-gray-100">
                             <div className="order-2 lg:order-1 relative">
                                <div className="rounded-tr-[80px] md:rounded-tr-[150px] rounded-bl-[80px] md:rounded-bl-[150px] rounded-tl-[32px] md:rounded-tl-[40px] rounded-br-[32px] md:rounded-br-[40px] overflow-hidden shadow-3xl aspect-[4/3] relative group">
                                    <Image 
                                        src="/events/impact/at cop29.png" 
                                        alt="Sauti at COP29" 
                                        fill 
                                        className="object-cover group-hover:scale-105 transition-transform duration-700" 
                                    />
                                </div>
                            </div>
                            <div className="order-1 lg:order-2">
                                <h2 className="text-2xl md:text-4xl font-black text-sauti-blue mb-4 md:mb-6 uppercase tracking-tighter">Impact at Scale.</h2>
                                <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-6 md:mb-8 font-medium">
                                    Our work is global because the systems of harm are global. We bring survivor voices to the forefront of climate and justice policy.
                                </p>
                            </div>
                        </div>
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
}

function StatBlock({ value, label }: { value: string, label: string }) {
    return (
        <div className="flex flex-col gap-2 md:gap-4">
            <div className="text-4xl md:text-7xl font-black text-sauti-orange tracking-tighter transition-all">{value}</div>
            <div className="text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">
                {label}
            </div>
        </div>
    )
}

function ImpactRow({ title, description }: { title: string, description: string }) {
    return (
        <div className="flex items-start gap-4 md:gap-8 p-4 md:p-8 rounded-[24px] md:rounded-[32px] bg-gray-50 hover:bg-white border-2 border-transparent hover:border-gray-100 hover:shadow-2xl transition-all group">
            <div className="h-10 w-10 md:h-14 md:w-14 rounded-[12px] md:rounded-2xl bg-sauti-blue text-white flex items-center justify-center flex-shrink-0 shadow-lg group-hover:rotate-12 transition-transform">
                <CheckCircle2 className="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div>
                <h3 className="text-xl md:text-2xl font-bold text-sauti-blue mb-1 md:mb-2">{title}</h3>
                <p className="text-sm md:text-lg text-gray-600 font-medium">{description}</p>
            </div>
        </div>
    )
}
