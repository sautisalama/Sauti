"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Shield, Heart, Scale, Landmark } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CircledText } from "@/components/ui/CircledText";

const PROGRAM_DATA: Record<string, any> = {
    "access-to-care": {
        title: "Access to Care & Support",
        subtitle: "Psychosocial, Medical, and Shelter Pathways",
        icon: <Heart className="w-16 h-16 text-sauti-yellow" />,
        description: "We strengthen referral pathways to ensure survivors can access trauma-informed care without delay or discrimination. By partnering with local health providers and shelters, we bridge the gap between initial reporting and long-term recovery.",
        images: ["/events/impact/Community -Letu.png", "/events/impact/startegic plan meeting.png"],
        details: [
            "Survivor-led psychosocial support networks that prioritize emotional safety.",
            "Coordinated medical referral trees for immediate physical care and forensic documentation.",
            "Strategic partnerships with safe houses and community-led shelter initiatives."
        ]
    },
    "prevention": {
        title: "Community Prevention",
        subtitle: "Collective Responsibility & Safety",
        icon: <Shield className="w-16 h-16 text-sauti-yellow" />,
        description: "Violence prevention starts with community ownership. We work with young people, caregivers, and local leaders to challenge harmful norms and build 'Circles of Safety' that protect the most vulnerable.",
        images: ["/events/impact/Learning Program - 748 registered learners.png", "/events/impact/Community -Letu.png"],
        details: [
            "Bystander intervention training tailored for various community settings.",
            "Long-term school-based programs focused on consent and healthy relationships.",
            "Community safety mapping to identify and mitigate high-risk environments."
        ]
    },
    "legal-access": {
        title: "Legal Access & Advocacy",
        subtitle: "Justice That Serves Survivors",
        icon: <Scale className="w-16 h-16 text-sauti-yellow" />,
        description: "Navigating the justice system is often re-traumatising. We provide legal literacy, accompaniment, and advocacy to ensure that laws are not just written but felt in the lives of women and girls.",
        images: ["/events/impact/at cop29.png", "/events/impact/at cop30.png"],
        details: [
            "Legal literacy workshops to empower survivors with knowledge of their rights.",
            "Courtroom accompaniment and navigation support for ongoing cases.",
            "Policy advocacy at local and national levels to close justice gaps."
        ]
    },
    "feminist-tech": {
        title: "Feminist Tech",
        subtitle: "Digital Tools for Safety",
        icon: <Landmark className="w-16 h-16 text-sauti-yellow" />,
        description: "Sauti Salama designs and maintains digital tools that expand access to care and information while prioritising consent, safety, and accountability.",
        images: ["/events/impact/startegic plan meeting.png", "/events/impact/at cop29.png"],
        details: [
            "Development of secure, privacy-first platforms for confidential information access.",
            "Digital hygiene and security training for grassroots activists and survivors.",
            "Advocating for ethical data practices within the global development sector."
        ]
    }
};

export default function ProgramDetailPage() {
    const params = useParams();
    const slug = params.slug as string;
    const program = PROGRAM_DATA[slug];

    if (!program) {
        return <div className="p-20 text-center">Program not found</div>;
    }

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="py-24 md:py-32 bg-[#f4f7fa]">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <Link href="/programs" className="flex items-center gap-2 text-sauti-dark font-black mb-12 hover:translate-x-[-8px] transition-transform">
                            <ArrowLeft className="w-6 h-6" /> Back to All Programs
                        </Link>
                        
                        <div className="grid lg:grid-cols-2 gap-20 items-center">
                            <div>
                                <div className="mb-8">{program.icon}</div>
                                <h1 className="text-3xl md:text-6xl lg:text-8xl font-black text-sauti-dark mb-4 md:mb-6 leading-tight">
                                    {program.title}
                                </h1>
                                <p className="text-xl md:text-2xl text-sauti-yellow font-bold uppercase tracking-widest">{program.subtitle}</p>
                            </div>
                            <div className="bg-white p-8 md:p-12 rounded-[40px] md:rounded-[60px] shadow-3xl">
                                <p className="text-xl md:text-2xl text-gray-600 leading-relaxed font-medium italic">
                                    "{program.description}"
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-24">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-12 mb-24">
                            {program.images.map((img: string, i: number) => (
                                <div key={i} className="rounded-[80px] overflow-hidden aspect-video relative shadow-2xl hover:scale-[1.02] transition-transform duration-700">
                                    <Image src={img} alt="" fill className="object-cover" />
                                </div>
                            ))}
                        </div>

                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-black text-sauti-dark mb-10 md:mb-16 border-b-4 md:border-b-8 border-sauti-yellow/20 pb-4 md:pb-6 w-fit">Deep Dive.</h2>
                            <div className="space-y-12">
                                {program.details.map((detail: string, i: number) => (
                                    <div key={i} className="flex gap-4 md:gap-8 items-start">
                                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-sauti-dark text-white flex items-center justify-center shrink-0 shadow-lg">
                                            <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                                        </div>
                                        <p className="text-xl md:text-3xl font-bold text-gray-800 leading-relaxed">
                                            {detail}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-24 bg-[#1a365d] text-white overflow-hidden">
                    <div className="container px-4 text-center relative z-10">
                        <h2 className="text-4xl md:text-7xl font-bold mb-12 leading-tight">Ready to take action?</h2>
                        <div className="flex flex-wrap justify-center gap-6">
                            <Link href="/volunteer">
                                <Button className="rounded-full bg-sauti-yellow text-sauti-dark px-8 md:px-12 py-6 md:py-10 text-xl md:text-2xl font-black hover:scale-105 transition-transform hover:bg-sauti-yellow/90">
                                    Join Our Collective
                                </Button>
                            </Link>
                            <Link href="/impact">
                                <Button className="rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-md text-white px-8 md:px-12 py-6 md:py-10 text-xl md:text-2xl font-black hover:bg-white hover:text-[#1a365d] transition-all">
                                    See Our Impact
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
