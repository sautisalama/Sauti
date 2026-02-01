"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { ShieldAlert, Users, School, Megaphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PreventionPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="pt-24 pb-16 md:py-32 bg-[#fffbeb]">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <span className="inline-block px-4 py-1 rounded-full bg-sauti-orange/10 text-sauti-orange text-sm font-bold mb-6 uppercase tracking-widest">
                                    Breaking the Cycle
                                </span>
                                <h1 className="text-5xl md:text-7xl font-black text-sauti-blue mb-8 leading-tight">
                                    Prevention <span className="relative inline-block px-4">
                                        Strategies
                                        <div className="absolute bottom-0 left-0 w-full h-full border-[4px] border-[#00cf8d] rounded-[100%] rotate-[-2deg] opacity-60 pointer-events-none" />
                                    </span>
                                </h1>
                                <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-10 font-medium font-serif">
                                    Community-led initiatives and education designed to address the root causes of violence and build safer ecosystems for everyone.
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <Link href="/signup">
                                        <Button className="rounded-full bg-[#ebc13d] text-[#00473e] px-8 py-7 text-lg font-black shadow-xl hover:bg-[#d4ac31] transition-all">
                                            Join a Dialogue
                                        </Button>
                                    </Link>
                                    <Link href="/signup">
                                        <Button variant="outline" className="rounded-full border-2 border-sauti-blue text-sauti-blue px-8 py-7 text-lg font-black hover:bg-sauti-blue hover:text-white transition-all">
                                            Explore the App
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="relative aspect-square md:aspect-[4/3] rounded-[60px] overflow-hidden shadow-3xl">
                                <Image 
                                    src="/events/programs/16 days of activism.png" 
                                    alt="Prevention" 
                                    fill 
                                    className="object-cover" 
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-24 bg-white">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <FeatureCard icon={<School className="w-8 h-8 text-sauti-orange" />} title="School Programs" description="Educating students on consent, healthy relationships, and digital safety." />
                            <FeatureCard icon={<Users className="w-8 h-8 text-sauti-orange" />} title="Community dialogues" description="Engaging local leaders and community members in transformative justice." />
                            <FeatureCard icon={<Megaphone className="w-8 h-8 text-sauti-orange" />} title="Campaigns" description="Broad-scale awareness through our 'Sauti Yako' storytelling platform." />
                            <FeatureCard icon={<ShieldAlert className="w-8 h-8 text-sauti-orange" />} title="Risk Assessment" description="Tools for identifying and mitigating violence within household settings." />
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
