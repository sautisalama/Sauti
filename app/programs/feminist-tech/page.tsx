"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { Laptop, Lock, Smartphone, Cpu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function FeministTechPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="pt-24 pb-16 md:py-32 bg-[#f3f4f6]">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <span className="inline-block px-4 py-1 rounded-full bg-sauti-orange/10 text-sauti-orange text-sm font-bold mb-6 uppercase tracking-widest">
                                    Safe Infrastructure
                                </span>
                                <h1 className="text-5xl md:text-7xl font-black text-sauti-blue mb-8 leading-tight">
                                    Feminist <span className="relative inline-block px-4">
                                        Tech
                                        <div className="absolute bottom-0 left-0 w-full h-full border-[4px] border-[#00cf8d] rounded-[100%] rotate-[-2deg] opacity-60 pointer-events-none" />
                                    </span>
                                </h1>
                                <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-10 font-medium font-serif">
                                    Developing and deploying safe, decentralized, and anonymous digital tools to empower survivors while protecting their data and identity.
                                </p>
                                <Link href="/signup">
                                    <Button className="rounded-full bg-[#ebc13d] text-[#00473e] px-8 py-7 text-lg font-black shadow-xl hover:bg-[#d4ac31] transition-all">
                                        Explore the App
                                    </Button>
                                </Link>
                            </div>
                            <div className="relative aspect-square md:aspect-[4/3] rounded-[60px] overflow-hidden shadow-3xl">
                                <Image src="/events/programs/AI course.png" alt="Feminist Tech" fill className="object-cover" />
                            </div>
                        </div>
                    </div>
                </section>
                <section className="py-24 bg-white">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <FeatureCard icon={<Lock className="w-8 h-8 text-sauti-orange" />} title="Encryption" description="Military-grade security for all survivor communication and reports." />
                            <FeatureCard icon={<Smartphone className="w-8 h-8 text-sauti-orange" />} title="Anonymous Mode" description="Access resources and report harm without revealing your identity." />
                            <FeatureCard icon={<Cpu className="w-8 h-8 text-sauti-orange" />} title="Open Source" description="Transparent, community-governed technology auditing and development." />
                            <FeatureCard icon={<Laptop className="w-8 h-8 text-sauti-orange" />} title="Digital Literacy" description="Training survivors on operational security and online safety." />
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
        <div className="p-8 rounded-[40px] bg-white border-2 border-gray-50 hover:border-sauti-orange/20 hover:shadow-2xl transition-all group">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6">{icon}</div>
            <h3 className="text-2xl font-black text-sauti-blue mb-4 uppercase tracking-tight">{title}</h3>
            <p className="text-gray-500 font-medium leading-relaxed">{description}</p>
        </div>
    );
}
