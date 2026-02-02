"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { Terminal, ShieldCheck, Database, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function FeministTechImpactPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main id="main-content" className="flex-1">
                <section className="py-12 md:py-24 lg:py-32 bg-[#f8fafc]">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                            <div>
                                <span className="inline-block px-4 py-1.5 rounded-full bg-sauti-yellow/10 text-sauti-yellow text-[10px] md:text-sm font-bold mb-6 md:mb-8 uppercase tracking-widest">
                                    Impact: Digital Safety
                                </span>
                                <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark mb-6 md:mb-8 leading-tight">
                                    Feminist Tech Impact
                                </h1>
                                <p className="text-lg md:text-xl lg:text-2xl text-gray-600 leading-relaxed mb-8 md:mb-12 font-medium">
                                    Scaling safe digital infrastructure to protect survivors and ensure technology serves as a tool for liberation.
                                </p>
                                <div className="flex justify-center md:justify-start">
                                     <Link href="/signup">
                                        <Button className="rounded-full bg-sauti-dark text-white px-8 md:px-12 py-6 md:py-10 text-lg md:text-2xl font-black shadow-xl hover:bg-sauti-dark/90 transition-all">
                                            Explore Sauti App
                                        </Button>
                                     </Link>
                                </div>
                            </div>
                            <div className="relative aspect-[4/3] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-3xl">
                                <Image src="/events/programs/TFGBV Awareness.png" alt="Feminist Tech Impact" fill className="object-cover" />
                            </div>
                        </div>
                    </div>
                </section>
                <section className="py-12 md:py-24 bg-white">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                            <FeatureCard icon={<ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Scale Protection" description="Protecting 5,000+ survivor interactions through end-to-end encryption." />
                            <FeatureCard icon={<Zap className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Rapid Response" description="Low-latency reporting tools for immediate crisis management." />
                            <FeatureCard icon={<Database className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Data Sovereignty" description="Ensuring survivors have complete ownership and control over their data." />
                            <FeatureCard icon={<Terminal className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />} title="Tech Literacy" description="Bridging the digital divide for 1,000+ women in grassroots organizing." />
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
            <h3 className="text-xl md:text-2xl font-black text-sauti-blue mb-4 uppercase tracking-tight">{title}</h3>
            <p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">{description}</p>
        </div>
    );
}
