"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Megaphone, Users, ArrowRight, TrendingUp } from "lucide-react";

export default function EndFemicidePage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main id="main-content" className="flex-1">
                {/* Hero */}
                <section className="relative h-[60vh] md:h-[80vh] flex items-end pb-20 overflow-hidden">
                    <Image
                        src="/events/impact/end femicide march.jpeg"
                        alt="End Femicide March"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-sauti-dark via-sauti-dark/60 to-transparent" />
                    
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <Link href="/impact">
                            <Button variant="ghost" className="text-white hover:bg-white/10 mb-8 rounded-full">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
                            </Button>
                        </Link>
                        <span className="inline-block px-4 py-1 rounded-full bg-sauti-red text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
                            National Movement
                        </span>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 max-w-4xl">
                            #EndFemicideKE
                        </h1>
                        <p className="text-xl md:text-2xl text-white/90 max-w-2xl font-light">
                            From the 2024 marches to the 2025 Presidential Task Force, we are forcing the nation to reckon with its silence.
                        </p>
                    </div>
                </section>

                 {/* TLDR */}
                 <section className="py-12 bg-sauti-red/5 border-b border-sauti-red/10">
                     <div className="container px-4 max-w-4xl mx-auto">
                        <h2 className="text-sauti-red font-black uppercase tracking-widest text-sm mb-4">TLDR; Quick Overview</h2>
                        <div className="text-lg md:text-2xl font-bold text-sauti-dark leading-tight">
                             Following the historic January 2024 marches where thousands took to the streets, Sauti Salama has continued to pressure for accountability. Our advocacy contributed to the establishment of the Technical Working Group on GBV in 2025, moving from protest to policy reform.
                        </div>
                     </div>
                </section>

                {/* Content */}
                <section className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-16 items-start">
                             <div className="prose prose-lg md:prose-xl text-gray-600 leading-relaxed font-light">
                                <p className="text-2xl md:text-3xl text-sauti-dark font-bold mb-8 leading-tight">
                                    "Stop Killing Us."
                                </p>
                                <p className="mb-6">
                                    It started with a simple, horrifying fact: in January 2024 alone, at least 14 women were murdered. This sparked the "End Femicide" marches, the largest anti-GBV demonstrations in Kenya's history. Sauti Salama was on the frontlines, mobilizing youth in Nairobi and documenting the stories that mainstream media ignored.
                                </p>
                                <p className="mb-6">
                                    But marching was just the beginning. <strong>December 10, 2024</strong>, on Human Rights Day, we marched again, facing tear gas to remind the state that the killings hadn't stopped. Amnesty International reported a chilling statistic: one woman killed every 24 hours.
                                </p>
                                <p>
                                    Our persistence is paying off. in January 2025, the government established a 42-member task force to address femicide, a direct result of the pressure applied by feminist movements like ours. We are now monitoring this task force to ensure it delivers funding and justice, not just reports.
                                </p>
                            </div>
                            
                            <div className="space-y-8">
                                <div className="bg-white border border-gray-100 p-8 rounded-[32px] shadow-xl">
                                    <div className="flex items-center gap-4 mb-6">
                                        <TrendingUp className="w-10 h-10 text-sauti-red" />
                                        <h3 className="text-2xl font-bold text-sauti-dark">Timeline of Action</h3>
                                    </div>
                                    <div className="space-y-6 relative border-l-2 border-dashed border-gray-200 ml-5 pl-8">
                                        <div className="relative">
                                            <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-sauti-red border-4 border-white shadow-sm" />
                                            <div className="font-bold text-sauti-dark">Jan 2024</div>
                                            <div className="text-gray-600">Nationwide Marches commence.</div>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-gray-300 border-4 border-white shadow-sm" />
                                            <div className="font-bold text-sauti-dark">Nov 2024</div>
                                            <div className="text-gray-600">"UNiTE" March on GBV elimination day.</div>
                                        </div>
                                         <div className="relative">
                                            <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-gray-300 border-4 border-white shadow-sm" />
                                            <div className="font-bold text-sauti-dark">Dec 2024</div>
                                            <div className="text-gray-600">Human Rights Day Protests.</div>
                                        </div>
                                         <div className="relative">
                                            <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-sauti-teal border-4 border-white shadow-sm" />
                                            <div className="font-bold text-sauti-dark">Jan 2025</div>
                                            <div className="text-gray-600">Presidential Task Force formed.</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-sauti-dark py-24 text-center">
                    <div className="container px-4 mx-auto">
                        <h2 className="text-3xl text-white font-bold mb-8">We are watching.</h2>
                         <p className="text-white/60 max-w-2xl mx-auto mb-10 text-lg">
                             Join our mailing list to get updates on the Task Force's progress and upcoming assembly dates.
                         </p>
                        <Link href="/volunteer">
                            <Button className="rounded-full bg-sauti-red text-white px-10 py-6 text-lg font-bold hover:bg-sauti-red/90 shadow-xl shadow-sauti-red/20">
                                Join the Movement <ArrowRight className="ml-2 w-5 h-5"/>
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
