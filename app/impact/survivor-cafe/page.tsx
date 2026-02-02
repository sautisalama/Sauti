"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, Heart, Shield, ArrowRight, MessageCircle } from "lucide-react";

export default function SurvivorCafePage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main id="main-content" className="flex-1">
                {/* Hero */}
                <section className="relative h-[60vh] md:h-[80vh] flex items-center md:items-end pb-20 overflow-hidden bg-black">
                    <div className="absolute inset-0 z-0 opacity-60">
                         <Image
                            src="/events/programs/survivors cafe program.png"
                            alt="Survivor Cafe"
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                     <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <Link href="/impact">
                            <Button variant="ghost" className="text-white hover:bg-white/10 mb-8 rounded-full">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
                            </Button>
                        </Link>
                        <span className="inline-block px-4 py-1 rounded-full bg-sauti-teal text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
                            Digital Safe Space
                        </span>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 max-w-4xl">
                            Survivor Cafe: Online
                        </h1>
                         <p className="text-xl md:text-2xl text-white/90 max-w-2xl font-light leading-relaxed">
                            A virtual sanctuary for healing, connection, and reclaiming joy in a supportive community.
                        </p>
                    </div>
                </section>

                 {/* TLDR */}
                 <section className="py-12 bg-gray-50 border-b border-gray-100">
                     <div className="container px-4 max-w-4xl mx-auto">
                        <h2 className="text-sauti-teal font-black uppercase tracking-widest text-sm mb-4">TLDR; Quick Overview</h2>
                        <div className="text-lg md:text-2xl font-bold text-sauti-dark leading-tight">
                             The Survivor Cafe isn't a physical coffee shop—it's an exclusive online community. We merge urgent professional help with peer support, offering a safe digital space for survivors to share, heal, and access counselling from vetted professionals.
                        </div>
                     </div>
                </section>

                {/* Content */}
                <section className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-16 items-start">
                             <div className="prose prose-lg md:prose-xl text-gray-600 leading-relaxed font-light">
                                <h2 className="text-3xl md:text-4xl text-sauti-dark font-bold mb-8">
                                    Healing in the Digital Age.
                                </h2>
                                <p className="mb-6">
                                    In a world where physical spaces can sometimes feel unsafe or inaccessible, the Survivor Cafe provides a <strong>safe virtual harbour</strong>. This is more than a chat group; it is a structured community moderated by professionals and survivor-leaders.
                                </p>
                                <p className="mb-6">
                                    <strong>Care is our currency.</strong> We recognize that healing is non-linear. Some days, members need urgent crisis intervention, which we provide by linking them directly with our on-call psychologists and legal experts. On other days, the need is simply for solidarity—to share a virtual cup of tea with someone who understands exactly what it means to survive.
                                </p>
                                <p>
                                    Our WhatsApp and Instagram communities are gated to ensure privacy, creating a bubble of trust where vulnerability is met with validation, not judgment.
                                </p>
                            </div>
                            
                            <div className="bg-sauti-dark text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-sauti-teal rounded-full blur-[80px] opacity-20" />
                                <h3 className="text-2xl font-bold text-sauti-yellow mb-8 relative z-10">Join the Community</h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="bg-white/10 p-6 rounded-2xl flex items-center gap-4 hover:bg-white/20 transition-all cursor-pointer group">
                                         <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                                            <MessageCircle className="w-6 h-6 text-white" />
                                         </div>
                                         <div>
                                             <div className="font-bold text-lg">WhatsApp Community</div>
                                             <div className="text-white/60 text-sm">Strictly vetted • Invite Only</div>
                                         </div>
                                         <ArrowRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="bg-white/10 p-6 rounded-2xl flex items-center gap-4 hover:bg-white/20 transition-all cursor-pointer group">
                                         <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center shrink-0">
                                            <div className="w-6 h-6 border-2 border-white rounded-md" />
                                         </div>
                                         <div>
                                             <div className="font-bold text-lg">Instagram Safe Space</div>
                                             <div className="text-white/60 text-sm">Private Page • Daily Affirmations</div>
                                         </div>
                                         <ArrowRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                                <p className="mt-8 text-sm text-white/50 relative z-10">
                                    *To ensure the safety of all members, access links are provided after a brief verification process on our app.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
                
                <section className="bg-sauti-teal py-20 text-center">
                    <div className="container px-4 mx-auto">
                        <h2 className="text-3xl text-white font-bold mb-8">Need support right now?</h2>
                        <Link href="/signup">
                            <Button className="rounded-full bg-white text-sauti-teal px-10 py-6 text-lg font-bold hover:bg-gray-100 hover:scale-105 transition-all shadow-xl">
                                Access the Safe Space <ArrowRight className="ml-2 w-5 h-5"/>
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
