"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, Shield, Lock, ArrowRight, UserPlus, FileText, CheckCircle2 } from "lucide-react";

export default function PlatformPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main id="main-content" className="flex-1">
                {/* Hero */}
                <section className="relative pt-24 pb-20 md:pt-32 md:pb-32 overflow-hidden bg-gray-50">
                    <div className="container px-4 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
                        <div className="relative z-10 order-2 lg:order-1">
                            <Link href="/impact">
                                <Button variant="ghost" className="text-gray-500 hover:text-sauti-dark hover:bg-gray-100 mb-8 rounded-full pl-0">
                                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
                                </Button>
                            </Link>
                            <span className="inline-block px-4 py-1 rounded-full bg-sauti-teal text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
                                The Engine of Change
                            </span>
                            <h1 className="text-4xl md:text-6xl font-bold text-sauti-dark mb-6 leading-tight">
                                Connecting Over 500 Survivors to Care.
                            </h1>
                            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-lg">
                                The Sauti Salama platform is a fully-featured progressive web app (PWA) available on all devices. It disrupts the isolation of violence by providing immediate, secure connections to vetted professionals.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link href="/signup">
                                    <Button className="rounded-full bg-sauti-yellow text-sauti-dark px-8 py-6 text-lg font-bold hover:bg-sauti-yellow/90 shadow-xl">
                                        Experience the Platform
                                    </Button>
                                </Link>
                                <span className="inline-flex items-center text-sm font-medium text-gray-500 mt-4 px-4">
                                    <Smartphone className="w-4 h-4 mr-2" /> USSD Support Coming Soon
                                </span>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 relative">
                             {/* Large Desktop Mockup */}
                            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
                                <Image
                                    src="/platform/sauti salama - survivor dashboard - desktop.png"
                                    alt="Platform Dashboard"
                                    width={800}
                                    height={500}
                                    className="object-cover w-full h-auto"
                                    priority
                                />
                            </div>
                            {/* Mobile Float */}
                             <div className="absolute -bottom-10 -left-6 w-1/3 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-gray-900 bg-gray-900 aspect-[9/19]">
                                <Image
                                    src="/platform/sauti salama - survivor dashboard - mobile.png"
                                    alt="Mobile App"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                 {/* TLDR */}
                 <section className="py-12 bg-sauti-dark border-y border-white/10">
                     <div className="container px-4 max-w-4xl mx-auto">
                        <h2 className="text-sauti-yellow font-black uppercase tracking-widest text-sm mb-4">TLDR; Quick Overview</h2>
                        <div className="text-lg md:text-2xl font-bold text-white leading-tight">
                             This is our main tool for connecting survivors with support (legal, mental, medical, shelters). It allows for anonymous reporting and advice, or fully accompanied legal pursuit. All professionals are strictly vetted. We also support "Reporting on Behalf of," a critical feature for reporting cases involving children.
                        </div>
                     </div>
                </section>

                {/* Features Detail */}
                <section className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-5xl mx-auto">
                        
                        <div className="grid md:grid-cols-2 gap-16 items-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            <div>
                                <div className="w-16 h-16 bg-sauti-teal/10 rounded-2xl flex items-center justify-center text-sauti-teal mb-6">
                                    <Shield className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-2xl text-sauti-dark mb-4">Vetted Professional Network</h3>
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    We don't just list numbers; we curate care. Every lawyer, psychologist, and shelter manager on the platform undergoes a rigorous vetting process by the Sauti Salama team to ensure they adhere to survivor-centered and trauma-informed principles. You are safe here.
                                </p>
                            </div>
                            <div>
                                <div className="w-16 h-16 bg-sauti-red/10 rounded-2xl flex items-center justify-center text-sauti-red mb-6">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-2xl text-sauti-dark mb-4">Report on Behalf</h3>
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    Children cannot always speak for themselves. Our "Report on Behalf" feature allows trusted adults—teachers, neighbors, relatives—to securely flag abuse cases involving minors. These reports are prioritized for immediate intervention by our child protection partners.
                                </p>
                            </div>
                        </div>

                         <div className="bg-gray-50 rounded-[40px] p-10 md:p-14 text-center">
                            <h2 className="text-3xl font-bold text-sauti-dark mb-6">Choice is Power.</h2>
                            <p className="text-gray-600 max-w-2xl mx-auto text-lg mb-10">
                                Survivors retain full agency. You can choose to:
                            </p>
                            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="font-bold text-xl text-sauti-dark mb-2">Anonymous Route</div>
                                    <p className="text-gray-500">Get advice and psychosocial support without revealing your identity.</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="font-bold text-xl text-sauti-dark mb-2">Legal Route</div>
                                    <p className="text-gray-500"> Pursue justice with a dedicated case manager and legal representation.</p>
                                </div>
                            </div>
                         </div>
                    </div>
                </section>

                <section className="bg-sauti-light-teal py-20 text-center">
                    <div className="container px-4 mx-auto">
                        <h2 className="text-3xl text-sauti-dark font-bold mb-8">We need hands on deck.</h2>
                        <p className="text-gray-600 max-w-lg mx-auto mb-10">
                            Are you a qualified counselor, lawyer, or community organizer? Join the platform to offer your services to those who need them most.
                        </p>
                        <Link href="/volunteer">
                            <Button className="rounded-full bg-sauti-dark text-white px-10 py-6 text-lg font-bold hover:bg-sauti-dark/90 shadow-xl">
                                Sign up as a Volunteer <UserPlus className="ml-2 w-5 h-5"/>
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
