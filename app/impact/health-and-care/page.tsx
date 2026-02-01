"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { HeartPulse, Stethoscope, Brain, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HealthAndCarePage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="py-12 md:py-24 lg:py-32 bg-[#fff1f2]">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                            <div>
                                <span className="inline-block px-4 py-1.5 rounded-full bg-sauti-orange/10 text-sauti-orange text-[10px] md:text-sm font-bold mb-6 md:mb-8 uppercase tracking-widest">
                                    Impact: Holistic Health
                                </span>
                                <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-blue mb-6 md:mb-8 leading-tight">
                                    Health & Care
                                </h1>
                                <p className="text-lg md:text-2xl text-gray-600 leading-relaxed mb-8 md:mb-12 font-medium font-serif">
                                    Integrating medical care and mental health support to ensure a holistic path to healing and restoration for all survivors.
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
                                <Image src="/events/programs/survivors cafe program.png" alt="Survivor Cafe Program" fill className="object-cover" />
                            </div>
                        </div>
                    </div>
                </section>
                <section className="py-12 md:py-24 bg-white">
                    <div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-20 lg:mb-32">
                            <FeatureCard icon={<Stethoscope className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Medical Aid" description="Immediate medical assistance and long-term diagnostic support." />
                            <FeatureCard icon={<Brain className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Mental Health" description="Trauma-informed counselling and psychiatric services." />
                            <FeatureCard icon={<HeartPulse className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Holistic Care" description="Wellness programs focusing on physical and emotional restoration." />
                            <FeatureCard icon={<Users className="w-6 h-6 md:w-8 md:h-8 text-sauti-orange" />} title="Survivor Cafes" description="Peer-to-peer support networks for sustained mental well-being." />
                        </div>

                        <div className="bg-[#fff1f2] rounded-[32px] md:rounded-[60px] p-8 md:p-16 lg:p-20 flex flex-col md:flex-row gap-8 lg:gap-16 items-center">
                            <div className="md:w-1/2">
                                <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-sauti-blue mb-6 md:mb-8 uppercase tracking-tighter">Survivor Cafes</h2>
                                <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6 md:mb-8 font-medium">
                                    Our Survivor Cafes are safe, peer-led spaces. Here, survivors come together to share lived experiences, receive support, and build lasting networks of care.
                                </p>
                                <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10">
                                    <li className="flex items-center gap-3 md:gap-4 text-base md:text-xl font-bold text-sauti-blue">
                                        <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-sauti-orange" />
                                        Happens twice a month
                                    </li>
                                    <li className="flex items-center gap-3 md:gap-4 text-base md:text-xl font-bold text-sauti-blue">
                                        <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-sauti-orange" />
                                        Every Thursday (Bi-weekly)
                                    </li>
                                </ul>
                                <Link href="/volunteer">
                                    <Button className="rounded-full bg-white text-sauti-blue border-2 border-sauti-blue px-6 md:px-8 py-4 md:py-6 text-base md:text-lg font-bold hover:bg-sauti-blue hover:text-white transition-all">
                                        Join a Cafe Session
                                    </Button>
                                </Link>
                            </div>
                            <div className="md:w-1/2 relative aspect-video rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
                                <Image src="/events/impact/Learning Program - 748 registered learners.png" alt="Survivor Cafe Session" fill className="object-cover" />
                            </div>
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
        <div className="p-6 md:p-8 rounded-[32px] md:rounded-[40px] bg-white border-2 border-gray-50 hover:border-sauti-orange/20 hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-[16px] md:rounded-2xl bg-gray-50 flex items-center justify-center mb-6">{icon}</div>
            <h3 className="text-xl md:text-2xl font-black text-sauti-blue mb-4 uppercase tracking-tight">{title}</h3>
            <p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">{description}</p>
        </div>
    );
}
