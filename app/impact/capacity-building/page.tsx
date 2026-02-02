"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Laptop, GraduationCap, ArrowRight, Video } from "lucide-react";

export default function CapacityBuildingPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main id="main-content" className="flex-1">
                {/* Hero */}
                <section className="relative h-[60vh] md:h-[80vh] flex items-end pb-20 overflow-hidden">
                    <Image
                        src="/events/impact/Learning Program - 748 registered learners.png"
                        alt="Capacity Building"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <Link href="/impact">
                            <Button variant="ghost" className="text-white hover:bg-white/10 mb-8 rounded-full">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
                            </Button>
                        </Link>
                        <span className="inline-block px-4 py-1 rounded-full bg-sauti-yellow text-sauti-dark text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
                            Education & Skills
                        </span>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 max-w-4xl">
                            Independence is Adaptation
                        </h1>
                        <p className="text-xl md:text-2xl text-white/90 max-w-2xl font-light">
                            Equipping survivors with the skills to break free from the economic vulnerabilities that fuel violence.
                        </p>
                    </div>
                </section>

                 {/* TLDR */}
                 <section className="py-12 bg-sauti-yellow/10 border-b border-sauti-yellow/20">
                     <div className="container px-4 max-w-4xl mx-auto">
                        <h2 className="text-sauti-dark/60 font-black uppercase tracking-widest text-sm mb-4">TLDR; Quick Overview</h2>
                        <div className="text-lg md:text-2xl font-bold text-sauti-dark leading-tight">
                             We view gender-based violence as an adaptation of poverty. Our capacity building program is divided into Online Learning (AI, digital skills) and Outreach, providing partners' resources and specialized training to give women the financial independence needed to leave abusive situations.
                        </div>
                     </div>
                </section>

                {/* Content */}
                <section className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-7xl mx-auto">
                         <div className="grid lg:grid-cols-2 gap-16 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                             <div>
                                <h2 className="text-3xl md:text-5xl font-bold text-sauti-dark mb-8">Two Pillars of Growth.</h2>
                                <p className="text-lg text-gray-600 leading-relaxed mb-6">
                                    Our approach recognizes that knowledge is power only when it is accessible. We have structured our learning initiatives into two distinct streams to reach women regardless of their digital access.
                                </p>
                                
                                <div className="space-y-8 mt-10">
                                    <div className="bg-gray-50 p-8 rounded-[32px] border border-gray-100">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 bg-sauti-teal text-white rounded-full flex items-center justify-center">
                                                <Laptop className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-bold text-sauti-dark">1. Online Learning</h3>
                                        </div>
                                        <p className="text-gray-600">
                                            We partner with global tech leaders to offer courses in AI for Social Impact, digital marketing, and remote work readiness. These are high-value skills designed to open doors to the gig economy, allowing survivors to earn income safely from anywhere.
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 p-8 rounded-[32px] border border-gray-100">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 bg-sauti-red text-white rounded-full flex items-center justify-center">
                                                <GraduationCap className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-bold text-sauti-dark">2. Community Outreach</h3>
                                        </div>
                                        <p className="text-gray-600">
                                            For those without consistent internet access, we bring training to the community. Using our partner network, we facilitate workshops on financial literacy, leadership, and rights education directly in safe houses and community centers.
                                        </p>
                                    </div>
                                </div>
                             </div>
                             
                             <div className="relative h-full min-h-[500px] rounded-[40px] overflow-hidden shadow-2xl">
                                  <Image 
                                    src="/events/impact/oliver-teaching-tech.jpg" 
                                    alt="Tech Training" 
                                    fill 
                                    className="object-cover" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-sauti-dark/80 to-transparent flex items-end p-10">
                                    <div className="text-white">
                                        <div className="font-bold text-xl mb-2">Digital Independence</div>
                                        <p className="text-white/80">
                                            Tech Lead Oliver Wainaina upskilling women on digital safety tools.
                                        </p>
                                    </div>
                                </div>
                             </div>
                         </div>
                    </div>
                </section>

                <section className="bg-gray-50 py-20 text-center">
                    <div className="container px-4 mx-auto">
                        <h2 className="text-3xl text-sauti-dark font-bold mb-8">Ready to learn?</h2>
                        <Link href="/learn">
                            <Button className="rounded-full bg-sauti-teal text-white px-10 py-6 text-lg font-bold hover:bg-sauti-teal/90">
                                Explore Course Catalog <ArrowRight className="ml-2 w-5 h-5"/>
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
