"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scale, HeartPulse, Shield, MapPin, ArrowRight, Handshake } from "lucide-react";
import ContactModal from "@/components/ContactModal";

export default function VolunteerPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                <section className="py-12 md:py-24 lg:py-32">
                    <div className="container px-4 max-w-7xl mx-auto text-left">
                        <div className="mb-12 md:mb-24 max-w-3xl">
                             <div className="inline-block rounded-full px-4 py-1 text-xs md:text-sm font-bold bg-sauti-yellow/10 text-sauti-yellow mb-4 md:mb-6 uppercase tracking-wider">
                                Join our Collective
                            </div>
                            <div className="relative w-fit mb-8 md:mb-12">
                                <motion.h1 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-3xl md:text-5xl lg:text-7xl font-bold text-sauti-dark leading-tight relative z-10"
                                >
                                    Collective action for collective freedom.
                                </motion.h1>
                            </div>
                            <p className="text-lg md:text-2xl text-gray-600 leading-relaxed font-light">
                                Sauti Salama is built on the power of community. Join us in building the structural change required for a safer world.
                            </p>
                        </div>

                        <div className="space-y-24 md:space-y-40">
                            <InvolvementSection 
                                id="professionals"
                                number="01"
                                icon={<Scale className="w-10 h-10" />}
                                title="Lend Your Expertise"
                                subtitle="Legal, Health, and Mental Health Networks"
                                description="We bridge the gap between reporting and recovery through a specialized network of pro-bono professionals. Your skills can provide the critical infrastructure a survivor needs to reclaim their safety."
                                image="/dashboard/activism-image-woman-with-megaphone.png"
                                benefits={[
                                    "Pro-bono Legal representation & Paralegal support",
                                    "Trauma-informed Medical Care & Forensic services",
                                    "Licensed Psychosocial & Pastoral counseling"
                                ]}
                                buttonText="Join as a Professional"
                            />

                            <InvolvementSection 
                                id="mapping"
                                number="02"
                                icon={<MapPin className="w-10 h-10" />}
                                title="Map the Care"
                                subtitle="Submitting Vital Resources"
                                description="Accountability means knowing where safety exists. Help us build our ecosystem by suggesting shelters, funding opportunities, or partner organizations that align with survivor-led values."
                                image="/dashboard/featured.png"
                                benefits={[
                                    "Emergency Safe House locations",
                                    "Grassroots Funding opportunities",
                                    "Local GBV response organizations"
                                ]}
                                buttonText="Suggest a Resource"
                            />

                            <InvolvementSection 
                                id="community"
                                number="03"
                                icon={<Handshake className="w-10 h-10" />}
                                title="Circles of Safety"
                                subtitle="Youth-Led & Community-Owned"
                                description="Violence prevention starts with us. Join our local chapters to lead bystander interventions, consent workshops, and community safety mapping."
                                image="/events/impact/Community -Letu.png"
                                benefits={[
                                    "Youth-led bystander intervention",
                                    "Community dialogue facilitation",
                                    "Local safety mapping workshops"
                                ]}
                                buttonText="Start a Circle"
                            />
                        </div>
                    </div>
                </section>
                
                <section className="bg-[#f4f7fa] py-12 md:py-24">
                     <div className="container px-4 max-w-5xl mx-auto text-center">
                        <h2 className="text-2xl md:text-5xl font-bold text-sauti-dark mb-8 relative inline-block px-6">
                            Start a Conversation.
                        </h2>
                        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
                            Our collective response is only as strong as our communication. Reach out to coordinate impact.
                        </p>
                         <ContactModal 
                            trigger={
                                <Button className="rounded-full bg-sauti-dark text-white px-8 md:px-12 py-6 md:py-10 text-lg md:text-2xl font-black shadow-xl hover:bg-sauti-dark/90 transition-all">
                                    Get in Touch
                                </Button>
                            }
                            title="Start a Conversation"
                            description="Have a question or want to discuss a partnership? Send us a message below."
                        />
                     </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}

function InvolvementSection({ id, number, icon, title, subtitle, description, benefits, image, buttonText }: { id: string, number: string, icon: React.ReactNode, title: string, subtitle: string, description: string, benefits: string[], image?: string, buttonText: string }) {
    return (
        <div id={id} className="grid lg:grid-cols-2 gap-12 md:gap-16 lg:gap-32 items-center group scroll-mt-32">
            <div className="relative">
                <div className="text-5xl md:text-9xl font-black text-gray-100 absolute -top-8 md:-top-24 -left-2 md:-left-10 -z-10 select-none">
                    {number}
                </div>
                 <h3 className="text-2xl md:text-4xl lg:text-6xl font-bold text-sauti-dark mb-4 md:mb-6">{title}</h3>
                 <p className="text-lg md:text-2xl text-sauti-yellow font-bold mb-6 md:mb-10">{subtitle}</p>
                 {id === "professionals" ? (
                    <Link href="/signup">
                        <Button className="rounded-full bg-[#ebc13d] text-sauti-dark px-6 md:px-10 py-4 md:py-8 text-base md:text-xl font-black group shadow-xl hover:bg-sauti-yellow/90 transition-all">
                            Join Now
                            <ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                        </Button>
                    </Link>
                 ) : (
                    <ContactModal 
                        trigger={
                            <Button className="rounded-full bg-[#ebc13d] text-sauti-dark px-6 md:px-10 py-4 md:py-8 text-base md:text-xl font-black group shadow-xl hover:bg-sauti-yellow/90 transition-all">
                                {buttonText}
                                <ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                            </Button>
                        }
                        title={title}
                        description={`Express your interest in ${subtitle.toLowerCase()}.`}
                    />
                 )}
            </div>
            <div className="relative">
                {image && (
                    <div className="rounded-tr-[60px] md:rounded-tr-[120px] rounded-bl-[60px] md:rounded-bl-[120px] rounded-tl-[24px] md:rounded-tl-[40px] rounded-br-[24px] md:rounded-br-[40px] overflow-hidden shadow-2xl mb-8 md:mb-12 aspect-[4/3] relative group-hover:scale-[1.02] transition-transform duration-700">
                        <Image src={image} alt={title} fill className="object-cover" />
                    </div>
                )}
                <h4 className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 md:mb-8">What this involves</h4>
                <ul className="space-y-4 md:space-y-6">
                    {benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center gap-3 md:gap-6 p-3 md:p-4 rounded-2xl md:rounded-3xl hover:bg-gray-50 transition-colors border-b border-gray-100">
                             <div className="w-8 h-8 md:w-14 md:h-14 rounded-full bg-sauti-dark text-white flex items-center justify-center font-bold shadow-lg shrink-0">
                                 <ArrowRight className="w-4 h-4 md:w-6 md:h-6" />
                             </div>
                             <span className="text-base md:text-2xl font-bold text-gray-800">{benefit}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
