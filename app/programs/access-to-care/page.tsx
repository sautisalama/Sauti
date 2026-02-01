"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartPulse, Shield, Phone, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessToCarePage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                {/* Hero Section */}
                <section className="pt-24 pb-16 md:py-32 bg-[#f8f9fb]">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <span className="inline-block px-4 py-1 rounded-full bg-sauti-orange/10 text-sauti-orange text-sm font-bold mb-6 uppercase tracking-widest">
                                    Our Core Intervention
                                </span>
                                <h1 className="text-5xl md:text-7xl font-black text-sauti-blue mb-8 leading-tight">
                                    Access to <span className="relative inline-block px-4">
                                        Care
                                        <div className="absolute bottom-0 left-0 w-full h-full border-[4px] border-[#00cf8d] rounded-[100%] rotate-[-2deg] opacity-60 pointer-events-none" />
                                    </span>
                                </h1>
                                <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-10 font-medium font-serif">
                                    Trauma-informed psychosocial and medical referral networks designed to provide immediate safety and long-term healing for survivors.
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <Link href="/signup">
                                        <Button className="rounded-full bg-[#ebc13d] text-[#00473e] px-8 py-7 text-lg font-black shadow-xl hover:bg-[#d4ac31] transition-all">
                                            Get Immediate Help
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
                                    src="/events/programs/survivors cafe program.png" 
                                    alt="Access to Care" 
                                    fill 
                                    className="object-cover" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-sauti-blue/20 to-transparent" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Key Features */}
                <section className="py-24 bg-white">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <FeatureCard 
                                icon={<Phone className="w-8 h-8 text-sauti-orange" />}
                                title="24/7 Helpline"
                                description="Immediate crisis intervention and referral services available day and night."
                            />
                            <FeatureCard 
                                icon={<Coffee className="w-8 h-8 text-sauti-orange" />}
                                title="Survivor Cafes"
                                description="Safe, peer-led spaces for communal healing and shared experiences."
                            />
                            <FeatureCard 
                                icon={<HeartPulse className="w-8 h-8 text-sauti-orange" />}
                                title="Medical Referrals"
                                description="Direct connections to trauma-informed healthcare providers and forensic services."
                            />
                            <FeatureCard 
                                icon={<Shield className="w-8 h-8 text-sauti-orange" />}
                                title="Safe Shelter"
                                description="Temporary emergency housing for those in immediate danger from domestic violence."
                            />
                        </div>
                    </div>
                </section>

                {/* Detailed Context */}
                <section className="py-24 bg-gray-50 border-y border-gray-100">
                    <div className="container mx-auto px-6 max-w-4xl text-center">
                        <h2 className="text-4xl md:text-6xl font-black text-sauti-blue mb-10">Holistic Recovery.</h2>
                        <p className="text-xl md:text-2xl text-gray-500 leading-relaxed font-medium mb-12">
                            We don't just treat the immediate crisis; we build the path to long-term resilience. Through our network of specialized therapists, counsellors, and medical professionals, we ensure that every survivor receives the specific care they need without facing additional barriers.
                        </p>
                        <div className="bg-sauti-blue rounded-[40px] p-12 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-sauti-orange/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <h3 className="text-3xl font-bold mb-6">Need support now?</h3>
                            <p className="text-xl text-white/70 mb-8 font-medium">All our services are free, confidential, and survivor-led.</p>
                            <Button className="rounded-full bg-[#ebc13d] text-[#00473e] px-10 py-7 text-xl font-black shadow-xl hover:scale-105 transition-transform hover:bg-[#d4ac31]">
                                Call the GBV Hotline: 1195
                            </Button>
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
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6 group-hover:bg-sauti-orange/10 transition-colors">
                {icon}
            </div>
            <h3 className="text-2xl font-black text-sauti-blue mb-4 uppercase tracking-tight">{title}</h3>
            <p className="text-gray-500 font-medium leading-relaxed">{description}</p>
        </div>
    );
}
