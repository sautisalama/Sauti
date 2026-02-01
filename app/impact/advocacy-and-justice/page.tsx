"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { Gavel, Globe, Megaphone, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdvocacyAndJusticePage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="py-12 md:py-24 lg:py-32 bg-[#f0fdf4]">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                            <div>
                                <span className="inline-block px-4 py-1.5 rounded-full bg-sauti-orange/10 text-sauti-orange text-[10px] md:text-sm font-bold mb-6 md:mb-8 uppercase tracking-widest">
                                    Impact: Policy & Change
                                </span>
                                <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-blue mb-6 md:mb-8 leading-tight">
                                    Advocacy & Justice
                                </h1>
                                <p className="text-lg md:text-2xl text-gray-600 leading-relaxed mb-8 md:mb-12 font-medium font-serif">
                                    Driving structural change through survivor-led evidence and global partnerships to ensure a just future for all.
                                </p>
                                <div className="flex justify-center md:justify-start">
                                     <Link href="/signup">
                                        <Button className="rounded-full bg-sauti-blue text-white px-8 md:px-12 py-6 md:py-10 text-lg md:text-2xl font-black shadow-xl hover:bg-sauti-blue/90 transition-all">
                                            Explore Sauti App
                                        </Button>
                                     </Link>
                                </div>
                            </div>
                            <div className="relative aspect-[4/3] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-3xl">
                                <Image src="/events/impact/at cop29.png" alt="Advocacy at COP29" fill className="object-cover" />
                            </div>
                        </div>
                    </div>
                </section>
                <section className="py-12 md:py-24 bg-white">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-20 lg:mb-32">
                            <FeatureCard icon={<Gavel className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Legislative Input" description="Contributing survivor voices to national justice and safety frameworks." />
                            <FeatureCard icon={<Megaphone className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Mobilization" description="Building grassroots movements to demand accountability and safety." />
                            <FeatureCard icon={<FileText className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Evidence" description="Using data and survivor stories to influence public policy." />
                            <FeatureCard icon={<Globe className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Global Action" description="Partnering with international organizations for sustained impact." />
                        </div>

                        <div className="mb-20">
                            <h2 className="text-2xl md:text-5xl lg:text-6xl font-black text-sauti-blue mb-10 md:mb-12 uppercase tracking-tighter text-center">Mobilizing for Justice</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                <PosterCard image="/events/programs/16 days of activism.png" title="16 Days of Activism" year="2026" />
                                <PosterCard image="/events/impact/at cop29.png" title="Advocacy at COP29" year="2025" />
                                <PosterCard image="/events/impact/Community -Letu.png" title="Community Dialogue" year="2025" />
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}

function PosterCard({ image, title, year }: { image: string, title: string, year: string }) {
    return (
        <div className="group relative aspect-[3/4] rounded-[24px] md:rounded-[40px] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500">
            <Image src={image} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
            <div className="absolute bottom-6 md:bottom-10 left-6 md:left-10 right-6 md:right-10">
                <span className="text-sauti-orange font-bold text-xs md:text-sm uppercase tracking-widest mb-2 block">{year}</span>
                <h4 className="text-white text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">{title}</h4>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 md:p-8 rounded-[32px] md:rounded-[40px] bg-white border-2 border-gray-50 hover:border-sauti-orange/20 hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-[16px] md:rounded-2xl bg-gray-50 flex items-center justify-center mb-6">{icon}</div>
            <h3 className="text-xl md:text-2xl font-black text-sauti-blue mb-4 uppercase tracking-tight">{title}</h3>
            <p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">{description}</p>
        </div>
    );
}
