"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { Cloud, Sunrise, Shield, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClimateJusticePage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="py-12 md:py-24 lg:py-32 bg-[#ecfdf5]">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                            <div>
                                <span className="inline-block px-4 py-1.5 rounded-full bg-sauti-yellow/10 text-sauti-yellow text-[10px] md:text-sm font-bold mb-6 md:mb-8 uppercase tracking-widest">
                                    Impact: Environment & Safety
                                </span>
                                <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark mb-6 md:mb-8 leading-tight">
                                    Climate Justice
                                </h1>
                                <p className="text-lg md:text-2xl text-gray-600 leading-relaxed mb-8 md:mb-12 font-medium">
                                    Addressing the disproportionate impact of climate change on gender-based violence and building resilient communities.
                                </p>
                            </div>
                            <div className="relative aspect-[4/3] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-3xl">
                                <Image src="/events/impact/at cop30.png" alt="Climate Justice" fill className="object-cover" />
                            </div>
                        </div>
                    </div>
                </section>
                <section className="py-12 md:py-24 bg-white">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                            <FeatureCard icon={<Leaf className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Resilience" description="Building community safety nets that withstand environmental shocks." />
                            <FeatureCard icon={<Sunrise className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Resource Access" description="Ensuring survivors have access to basic needs during climate crises." />
                            <FeatureCard icon={<Shield className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Advocacy" description="Driving global policy at COP30 for gender-just climate action." />
                            <FeatureCard icon={<Cloud className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Safety Circles" description="Establishing 'Circles of Safety' in regions hit hardest by climate change." />
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 md:p-8 rounded-[32px] md:rounded-[40px] bg-white border-2 border-gray-50 hover:border-sauti-yellow/20 hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-[16px] md:rounded-2xl bg-gray-50 flex items-center justify-center mb-6">{icon}</div>
            <h3 className="text-xl md:text-2xl font-black text-sauti-dark mb-4 uppercase tracking-tight">{title}</h3>
            <p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">{description}</p>
        </div>
    );
}
