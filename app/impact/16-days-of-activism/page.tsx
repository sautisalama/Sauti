"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Shield, Users, ArrowRight, MousePointerClick } from "lucide-react";

export default function ActivismPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main id="main-content" className="flex-1">
                {/* Hero */}
                <section className="relative h-[60vh] md:h-[80vh] flex items-end pb-20 overflow-hidden">
                    <Image
                        src="/events/impact/16-days of activism 2.jpeg"
                        alt="16 Days of Activism"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-sauti-yellow/90 via-sauti-yellow/40 to-transparent mix-blend-multiply" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <Link href="/impact">
                            <Button variant="ghost" className="text-white hover:bg-white/10 mb-8 rounded-full">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
                            </Button>
                        </Link>
                        <span className="inline-block px-4 py-1 rounded-full bg-white text-sauti-dark text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
                            Annual Campaign
                        </span>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 max-w-4xl">
                            16 Days: UNiTE to End Violence
                        </h1>
                        <div className="flex flex-wrap gap-6 text-white font-medium text-sm md:text-base">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                <span>Nov 25 - Dec 10</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MousePointerClick className="w-5 h-5" />
                                <span>Focus: Digital Violence</span>
                            </div>
                        </div>
                    </div>
                </section>

                 {/* TLDR */}
                 <section className="py-12 bg-gray-50 border-b border-gray-100">
                     <div className="container px-4 max-w-4xl mx-auto">
                        <h2 className="text-sauti-yellow font-black uppercase tracking-widest text-sm mb-4">TLDR; Quick Overview</h2>
                        <div className="text-lg md:text-2xl font-bold text-sauti-dark leading-tight">
                             The 16 Days of Activism (Nov 25 - Dec 10) is our most intensive annual campaign. In alignment with the 2025 national theme, we are focusing on "Ending Digital Violence Against Women and Girls," hosting webinars, school talks, and legal clinics to combat cyber-harassment and image-based abuse.
                        </div>
                     </div>
                </section>

                {/* Content */}
                <section className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-4xl mx-auto">
                        <div className="prose prose-lg md:prose-xl text-gray-600 leading-relaxed font-light mb-16">
                            <p className="text-2xl md:text-3xl text-sauti-dark font-bold mb-8 leading-tight">
                                From Awareness to Action.
                            </p>
                            <p className="mb-8">
                                The 16 Days campaign bridges the gap between International Day for the Elimination of Violence Against Women and Human Rights Day. It is a reminder that women's rights are, fundamentally, human rights.
                            </p>
                            <p>
                                At Sauti Salama, we use this period to amplify specific, tailored messages. For the 2025 campaign, our focus shifts to the digital realm. As our lives move online, so does the violence. We are seeing a sharp rise in technology-facilitated gender-based violence (TFGBV), including doxxing, non-consensual sharing of intimate images, and online stalking. 
                            </p>
                            <p>
                               During these 16 days, we deploy our legal and tech teams to conduct "Digital Hygiene" clinics, teaching women how to secure their devices and helping survivors of digital abuse seek legal redress.
                            </p>
                        </div>

                        {/* Gallery Grid */}
                        <div className="grid md:grid-cols-2 gap-8 mb-16">
                            <div className="rounded-[32px] overflow-hidden shadow-lg aspect-square relative group">
                                <Image 
                                    src="/events/programs/16 days of activism.png" 
                                    alt="Community Dialogue" 
                                    fill 
                                    className="object-cover group-hover:scale-105 transition-transform duration-700" 
                                />
                            </div>
                            <div className="rounded-[32px] overflow-hidden shadow-lg aspect-square relative group bg-sauti-dark flex items-center justify-center p-8">
                                <div className="text-center">
                                    <h3 className="text-4xl font-bold text-sauti-yellow mb-4">Investment</h3>
                                    <p className="text-white/80">
                                        "Invest to Prevent" was the 2024 rallying cry. We continue this by pushing for county budget allocations for GBV shelters.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-sauti-dark py-20 text-center">
                    <div className="container px-4 mx-auto">
                        <h2 className="text-3xl text-white font-bold mb-8">Plan for November</h2>
                        <Link href="/volunteer">
                            <Button className="rounded-full bg-sauti-yellow text-sauti-dark px-10 py-6 text-lg font-bold hover:bg-sauti-yellow/90">
                                Become a Campaign Ambassador <ArrowRight className="ml-2 w-5 h-5"/>
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
