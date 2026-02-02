"use client";

import { Nav } from "./Nav";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import {
    Heart,
    Scale,
    Shield,
    Landmark,
    ArrowRight,
    Search,
    UsersRound,
    HeartHandshake,
    CalendarDays,
    AlertCircle,
    CheckCircle2,
    Lock,
    EyeOff,
    UserCheck,
    LifeBuoy,
    Stethoscope,
    HeartPulse,
    Gavel,
    Music2,
} from "lucide-react";
import { AccordionFAQs } from "./AccordionFAQs";
import { Button } from "./ui/button";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog";
import ReportAbuseForm from "./ReportAbuseForm";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Footer } from "./Footer";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { CircledText } from "@/components/ui/CircledText";

export function LandingPage() {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const supabase = createClient();
	const url = process.env.NEXT_PUBLIC_APP_URL!;

	useEffect(() => {
		const checkAuth = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setIsAuthenticated(!!session);
		};

		checkAuth();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setIsAuthenticated(!!session);
		});

		return () => subscription.unsubscribe();
	}, [supabase]);

	return (
		<div className="flex min-h-screen w-full flex-col bg-white">
			<Nav />
			<main className="min-h-[200vh]">
                {/* 1. HERO SECTION */}
				<section id="home" className="pt-4 md:pt-8 pb-8 md:pb-16">
					<div className="container mx-auto px-4 md:px-6 text-center lg:text-left">
						<div className="grid lg:grid-cols-2 gap-6 items-stretch">
							{/* Left Column */}
							<div className="flex flex-col gap-6">
								<div className="bg-sauti-dark rounded-[32px] md:rounded-[40px] px-6 py-10 md:px-8 md:py-16 flex flex-col justify-center flex-1 min-h-[400px] md:min-h-[500px] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-sauti-teal/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
									<span className="relative z-10 inline-flex w-fit px-4 py-2 rounded-full bg-sauti-teal/20 text-sauti-light-teal text-sm font-bold mb-8 uppercase tracking-wider mx-auto lg:mx-0 border border-sauti-teal/30">
										Safety, Care, and Justice.
									</span>
									<h1 className="relative z-10 font-sans text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-6 md:mb-8 tracking-tight">
										We are here for you.
									</h1>
									<p className="relative z-10 text-gray-300 text-base md:text-xl lg:text-2xl leading-relaxed mb-8 md:mb-10 max-w-2xl mx-auto lg:mx-0 font-medium">
                                        44% of Kenyan women have experienced physical or sexual violence from a partner. This is millions of women living in fear, suffering harm, and facing barriers to justice.
									</p>
									<div className="relative z-10 flex flex-wrap gap-3 md:gap-4 justify-center lg:justify-start">
										<Dialog>
											<DialogTrigger asChild>
												<Button
													size="lg"
													className="rounded-full px-6 md:px-8 py-5 md:py-7 text-sm md:text-lg font-bold bg-sauti-yellow text-sauti-dark hover:bg-sauti-yellow/50"
												>
													Get Support Now
												</Button>
											</DialogTrigger>
											<DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[24px] md:rounded-[32px]">
												<ReportAbuseForm />
											</DialogContent>
										</Dialog>
										<Link href="/programs">
											<Button
												size="lg"
												variant="ghost"
												className="rounded-full px-6 md:px-8 py-5 md:py-7 text-sm md:text-lg font-bold text-white hover:bg-white/10 group border-2 border-white/20"
											>
												Explore Our Work
												<ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
											</Button>
										</Link>
									</div>
								</div>

								{/* Trust Banner */}
								<div className="bg-sauti-yellow/50 rounded-[24px] md:rounded-[32px] p-6 md:p-10 flex flex-col sm:flex-row items-center justify-between shadow-lg gap-6">
                                    <div className="text-center sm:text-left">
                                        <h3 className="font-sans text-xl md:text-2xl font-bold text-sauti-dark mb-1 md:mb-2 tracking-tight">
                                            How can we help?
                                        </h3>
                                        <p className="text-sauti-dark/80 text-sm md:text-base max-w-sm font-medium">
                                           Mental Health • Legal Aid • Safe Shelters.
                                        </p>
                                    </div>
                                    <div className="flex gap-2 md:gap-3">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/40 border-2 border-white/50 flex items-center justify-center text-sauti-dark" title="Mental Health Support">
                                            <Heart className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" fillOpacity={0.2} />
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/40 border-2 border-white/50 flex items-center justify-center text-sauti-dark" title="Legal Aid">
                                            <Scale className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/40 border-2 border-white/50 flex items-center justify-center text-sauti-dark" title="Safe Shelters">
                                            <Shield className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                    </div>
								</div>
							</div>

							{/* Right - Image with Chat Bubbles */}
							<div className="bg-[#f2f1ef] rounded-[32px] md:rounded-[40px] overflow-hidden flex items-end justify-center min-h-[400px] md:min-h-[500px] relative p-6 md:p-10">
								<div className="relative w-full h-full flex items-end justify-center">
									<Image
										src="/landing/team.png"
										alt="Diverse community"
										width={800}
										height={600}
										className="w-full h-auto max-h-[80%] object-contain object-bottom grayscale contrast-125 mix-blend-multiply"
									/>
                                    
                                    {/* Speech Bubbles Overlay */}
									<div className="absolute inset-0 pointer-events-none">
										<div className="absolute top-0 left-0 w-16 md:w-24 h-auto opacity-90" style={{ filter: 'hue-rotate(330deg) saturate(1.2)' }}>
											<Image src="/landing/chat-bubble.webp" alt="" width={100} height={100} className="w-full h-auto" />
										</div>
										<div className="absolute top-4 left-[20%] w-20 md:w-28 h-auto opacity-85 -scale-x-100" style={{ filter: 'hue-rotate(240deg) saturate(1.5)' }}>
											<Image src="/landing/chat-bubble.webp" alt="" width={120} height={120} className="w-full h-auto" />
										</div>
										<div className="absolute top-0 right-[25%] w-18 md:w-24 h-auto opacity-90" style={{ filter: 'hue-rotate(180deg) saturate(1.3)' }}>
											<Image src="/landing/chat-bubble.webp" alt="" width={100} height={100} className="w-full h-auto" />
										</div>
										<div className="absolute top-6 right-0 w-14 md:w-18 h-auto opacity-85 -scale-x-100" style={{ filter: 'hue-rotate(300deg) saturate(1.4)' }}>
											<Image src="/landing/chat-bubble.webp" alt="" width={100} height={100} className="w-full h-auto" />
										</div>
										<div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-14 md:w-20 h-auto opacity-80" style={{ filter: 'hue-rotate(260deg) saturate(1.2)' }}>
											<Image src="/landing/chat-bubble.webp" alt="" width={80} height={80} className="w-full h-auto" />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>


                {/* 2. OUR STORY (ABOUT) */}
				<section id="about" className="py-12 md:py-20 bg-white">
					<div className="container mx-auto px-4 md:px-8 lg:px-16 max-w-[1400px]">
						<div className="text-center mb-12 md:mb-20 relative">
							<h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark relative z-10 tracking-tight">
								Our <CircledText circleColor="#F4B400">Story</CircledText>
							</h2>
						</div>
						<div className="bg-sauti-light-teal/30 rounded-[32px] md:rounded-[60px] p-6 md:p-12 lg:p-24 relative overflow-hidden">
							<div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start relative z-10">
								<div>
									<h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark mb-4 md:mb-6 leading-[1.1] tracking-tight">
										<span className="text-lg tracking-widest"> Averagely, </span> <br/>
										2 women <br/> 
                                        killed daily <br/>
										<span className="text-sauti-red">in 2025.</span>
									</h2>
                                    <div className="text-lg md:text-xl font-bold text-sauti-red uppercase tracking-widest mb-6 md:mb-10">in Kenya due to GBV</div>
                                    <p className="text-base md:text-xl lg:text-2xl text-gray-700 leading-relaxed font-medium max-w-xl mb-8 md:mb-12">
                                        Sauti Salama is a Kenyan feminist organisation founded and led by survivors who understand the challenges of getting help. We work to bridge gaps in access to care, safety, and justice for women and girls.
									</p>
                                    <Link href="/about">
                                        <Button id="aboutUsButton" className="rounded-full bg-sauti-dark text-white px-6 md:px-10 py-5 md:py-8 text-base md:text-xl font-black group shadow-xl hover:shadow-sauti-dark/20 transition-all">
                                            Read Our Story
                                            <ArrowRight className="ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                                        </Button>
                                    </Link>
								</div>
								<div className="flex flex-col gap-8 md:gap-12">
                                    <p className="text-lg md:text-xl lg:text-2xl text-gray-700 leading-relaxed font-medium max-w-xl mb-4">
                                        Our work emerges from community organising and survivor support, shaped by those with lived experience of navigating harm alone.
									</p>
									<FeatureRow 
										icon={<UsersRound className="w-6 h-6 md:w-8 md:h-8 text-sauti-teal" />} 
										title="Survivor-Led" 
										description="Led by women and survivors who understand the journey." 
									/>
									<FeatureRow 
										icon={<HeartHandshake className="w-6 h-6 md:w-8 md:h-8 text-sauti-teal" />} 
										title="Collective Care" 
										description="Care is central to justice and community resilience." 
									/>
									<FeatureRow 
										icon={<Shield className="w-6 h-6 md:w-8 md:h-8 text-sauti-teal" />} 
										title="Safety First" 
										description="Safety requires consent built into institutions and tools." 
									/>
								</div>
							</div>
                            {/* Integrated Stats */}
							<div className="flex flex-wrap gap-8 md:gap-24 lg:gap-32 mt-12 md:mt-24 pt-8 md:pt-16 border-t border-gray-200/60">
								<StatCompact value="500+" label="Survivors" />
								<StatCompact value="1000+" label="Educated" />
								<StatCompact value="95%" label="Success" />
							</div>
						</div>
					</div>
				</section>

                {/* 3. WHAT WE DO (PROGRAMS) */}
				<section id="programs" className="py-12 md:py-24 bg-white relative overflow-hidden">
					<div className="container max-w-7xl mx-auto px-4 md:px-6">
						<div className="text-center mb-12 md:mb-20 relative">
							<h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark relative z-10 leading-tight tracking-tight">
								Programs for <CircledText circleColor="#008080">Care & Justice</CircledText>
							</h2>
						</div>
						<p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto font-medium text-center mb-10 md:mb-16">Survivor-led, confidential, and designed to break down systems of harm.</p>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-12 md:mb-20">
							<ServiceCard 
								icon={<Heart className="w-8 h-8 md:w-10 md:h-10 text-sauti-teal" />}
								title="Access to Care"
								description="Strengthening pathways to psychosocial support and emergency response safely."
                                slug="access-to-care"
                                theme="teal"
							/>
							<ServiceCard 
								icon={<Shield className="w-8 h-8 md:w-10 md:h-10 text-sauti-yellow" />}
								title="Prevention"
								description="Working with youth and community actors to reduce isolation."
                                slug="prevention"
                                theme="yellow"
							/>
							<ServiceCard 
								icon={<Scale className="w-8 h-8 md:w-10 md:h-10 text-sauti-red" />}
								title="Legal Access"
								description="Improving justice through legal literacy and advocacy."
                                slug="legal-access"
                                theme="red"
							/>
							<ServiceCard 
								icon={<Landmark className="w-8 h-8 md:w-10 md:h-10 text-sauti-teal" />}
								title="Feminist Tech"
								description="Designing digital tools that prioritise consent and safety."
                                slug="feminist-tech"
                                theme="teal"
							/>
						</div>

                        <div className="flex justify-center">
                            <Link href="/programs">
                                <Button className="rounded-full bg-sauti-teal text-white px-8 md:px-12 py-6 md:py-10 text-lg md:text-2xl font-black group shadow-xl hover:shadow-sauti-teal/20 transition-all space-x-3 md:x-4">
                                    <span>Detailed Programs</span>
                                    <ArrowRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform" />
                                </Button>
                            </Link>
                        </div>
					</div>
				</section>

                {/* 4. DIGITAL PLATFORM (STAY CONNECTED) */}
				<div className="py-12 md:py-20 bg-white">
					<div className="container px-4">
						<div className="bg-sauti-dark rounded-[32px] md:rounded-[80px] p-8 md:p-16 lg:p-24 flex flex-col lg:flex-row gap-12 md:gap-20 items-center text-white overflow-hidden relative">
							<div className="lg:w-1/2 relative z-10">
                                <span className="inline-block rounded-full px-4 py-1 text-xs md:text-sm font-bold bg-sauti-yellow text-sauti-dark mb-4 md:mb-6 uppercase tracking-wider">
                                    Digital Infrastructure
                                </span>
								<h2 className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 md:mb-10 leading-tight tracking-tight">Sauti Salama Platform</h2>
								<p className="text-white/80 text-lg md:text-2xl mb-8 md:mb-12 leading-relaxed font-light">
									Our secure ecosystem provides survivors with the tools they need to navigate their journey with complete autonomy.
								</p>
								<ul className="grid sm:grid-cols-2 gap-x-8 gap-y-4 md:gap-y-8 mb-8 md:mb-12">
									{[
										"Survivor Reports",
										"Resource Directory",
										"Support Chat",
										"Legal Literacy Hub",
										"Evidence Storage",
										"Response Alerts"
									].map((item, i) => (
										<li key={i} className="flex items-center gap-3 md:gap-5">
											<div className="h-3 w-3 md:h-4 md:w-4 rounded-full bg-sauti-teal shadow-[0_0_15px_rgba(0,128,128,0.5)]" />
											<span className="text-white/90 text-base md:text-xl font-medium">{item}</span>
										</li>
									))}
								</ul>
                                <div className="flex flex-wrap gap-4 md:gap-6">
                                    <Link href="/volunteer">
                                        <Button className="bg-sauti-yellow text-sauti-dark hover:bg-sauti-yellow/90 rounded-full px-8 md:px-12 py-6 md:py-10 text-lg md:text-2xl font-black shadow-2xl">
                                            Join Movement
                                        </Button>
                                    </Link>
                                    <Link href="/signup">
                                        <Button variant="outline" className="text-white border-2 border-white/20 hover:bg-white/10 rounded-full px-8 md:px-12 py-6 md:py-10 text-lg md:text-2xl font-black shadow-2xl">
                                            Explore App
                                        </Button>
                                    </Link>
                                </div>
							</div>
							<div className="lg:w-1/2 w-full hidden md:flex items-center justify-center relative h-[400px] lg:h-[500px]">
								{/* Desktop Mockup */}
								<div className="absolute top-1/2 -translate-y-1/2 left-0 w-[85%] aspect-video bg-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden z-10 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
									<div className="w-full h-6 bg-gray-800 flex items-center px-3 gap-1.5">
										<div className="w-2.5 h-2.5 rounded-full bg-red-500"/>
										<div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/>
										<div className="w-2.5 h-2.5 rounded-full bg-green-500"/>
									</div>
									<div className="relative w-full h-full bg-white">
										<Image src="/platform/sauti salama - survivor dashboard - desktop.png" alt="Desktop Dashboard" fill className="object-cover object-top" />
									</div>
								</div>

								{/* Mobile Mockup */}
								<div className="absolute bottom-4 right-4 w-[140px] lg:w-[160px] aspect-[9/19] bg-gray-900 rounded-[2rem] border-[6px] border-gray-900 shadow-2xl overflow-hidden z-20 transform translate-y-4 hover:translate-y-0 transition-transform duration-500">
									<div className="relative w-full h-full bg-white">
										<Image src="/platform/sauti salama - survivor dashboard - mobile.png" alt="Mobile App" fill className="object-cover" />
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

                {/* 5. IMPACT & CHANGE (BENTO GRID) */}
                <section className="py-12 md:py-24 bg-[#f8f9fb]">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="text-center mb-12 md:mb-20 relative">
                            <h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-blue relative z-10 leading-tight">
                                Collective <CircledText circleColor="#F4B400">Change</CircledText>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 items-stretch">
                            {/* Column 1 */}
                            <div className="flex flex-col gap-6 md:gap-10">
                                <div className="rounded-[24px] md:rounded-[40px] overflow-hidden aspect-video relative shadow-2xl hover:scale-[1.02] transition-transform duration-500">
                                    <Image src="/events/impact/Community -Letu.png" alt="Community gathering" fill className="object-cover" />
                                </div>
                                <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-xl flex-1 flex flex-col">
                                    <h3 className="text-2xl md:text-3xl font-bold text-[#1a365d] mb-4 md:mb-6">Health & Care</h3>
                                    <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6 md:mb-10 flex-1">
                                        Trauma-informed psychosocial and medical referral networks for survivors.
                                    </p>
                                    <Link href="/impact/health-and-care" className="text-[#1a365d] font-bold border-b-2 border-[#1a365d] w-fit pb-1 hover:text-sauti-orange hover:border-sauti-orange transition-all flex items-center gap-2 group/link">
                                        More <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>

                            {/* Column 2 */}
                            <div className="flex flex-col gap-6 md:gap-10 md:pt-16">
                                <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-xl flex-1 flex flex-col">
                                    <h3 className="text-2xl md:text-3xl font-bold text-[#1a365d] mb-4 md:mb-6">Advocacy & Justice</h3>
                                    <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6 md:mb-10 flex-1">
                                        Empowering survivors to navigate legal systems and advocating for systemic change.
                                    </p>
                                    <Link href="/impact/advocacy-and-justice" className="text-[#1a365d] font-bold border-b-2 border-[#1a365d] w-fit pb-1 hover:text-sauti-orange hover:border-sauti-orange transition-all flex items-center gap-2 group/link">
                                        More <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                                <div className="rounded-[24px] md:rounded-[40px] overflow-hidden aspect-video relative shadow-2xl hover:scale-[1.02] transition-transform duration-500">
                                    <Image src="/events/impact/at cop30.png" alt="Advocacy action" fill className="object-cover" />
                                </div>
                            </div>

                            {/* Column 3 */}
                            <div className="flex flex-col gap-6 md:gap-10">
                                <div className="rounded-[24px] md:rounded-[40px] overflow-hidden aspect-video relative shadow-2xl hover:scale-[1.02] transition-transform duration-500">
                                    <Image src="/events/impact/oliver-teaching-tech.jpg" alt="Strategic meeting" fill className="object-cover" />
                                </div>
                                <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-xl flex-1 flex flex-col">
                                    <h3 className="text-2xl md:text-3xl font-bold text-[#1a365d] mb-4 md:mb-6">Education Access</h3>
                                    <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6 md:mb-10 flex-1">
                                        Equipping youth with tools and knowledge to prevent violence and lead within communities.
                                    </p>
                                    <Link href="/impact/youth-leadership" className="text-[#1a365d] font-bold border-b-2 border-[#1a365d] w-fit pb-1 hover:text-sauti-orange hover:border-sauti-orange transition-all flex items-center gap-2 group/link">
                                        More <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. UPCOMING EVENTS */}
                <section id="events" className="py-12 md:py-24 bg-white">
                    <div className="container mx-auto px-4 max-w-6xl">
                         <div className="text-center mb-12 md:mb-20 relative">
                            <h2 className="text-3xl md:text-5xl lg:text-7xl font-bold text-[#1a365d] relative z-10 leading-tight">
                                Upcoming <CircledText circleColor="#00cf8d">Actions</CircledText>
                            </h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                            {/* Card 1: Survivor Cafe */}
                            <Link href="/impact/health-and-care" className="group">
                                <div className="bg-[#f0f4f8] rounded-[32px] md:rounded-[60px] p-6 md:p-12 flex flex-col h-full hover:shadow-2xl transition-all duration-500 border border-transparent hover:border-gray-100 overflow-hidden relative">
                                    <div className="absolute top-0 left-0 w-full h-[240px] md:h-[320px] rounded-t-[32px] md:rounded-t-[60px] overflow-hidden">
                                        <Image src="/events/programs/survivors cafe program.png" alt="Survivor Cafe" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                                    </div>
                                    <div className="mt-[200px] md:mt-[260px] relative z-20">
                                        <span className="inline-flex items-center gap-2 md:gap-3 text-sauti-orange font-bold mb-4 md:mb-8 text-sm md:text-lg px-4 md:px-6 py-1.5 md:py-2 rounded-full bg-white shadow-xl border border-gray-50">
                                            <CalendarDays className="w-4 h-4 md:w-6 md:h-6" /> Bi-monthly
                                        </span>
                                        <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold text-[#1a365d] mb-4 md:mb-6 group-hover:text-sauti-orange transition-colors">
                                            Survivor Cafes
                                        </h3>
                                        <p className="text-gray-500 font-bold mb-4 md:mb-8 text-lg md:text-xl">Peer Support</p>
                                        <p className="text-gray-600 leading-relaxed text-base md:text-lg mb-8 md:mb-10 flex-1">
                                            A peer-to-peer support network for sustained mental well-being and shared healing.
                                        </p>
                                        <div className="pt-6 md:pt-10 border-t border-gray-200">
                                            <span className="text-[#1a365d] font-black text-lg md:text-xl flex items-center gap-2 md:gap-3 group-hover:translate-x-2 transition-transform">Learn More <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-sauti-orange"/></span>
                                        </div>
                                    </div>
                                </div>
                            </Link>

                             {/* Card 2: 16 Days of Activism */}
                             <Link href="/impact/advocacy-and-justice" className="group">
                                <div className="bg-[#1a365d] rounded-[32px] md:rounded-[60px] p-6 md:p-12 flex flex-col h-full text-white hover:shadow-2xl transition-all duration-500 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-[240px] md:h-[320px] rounded-t-[32px] md:rounded-t-[60px] overflow-hidden">
                                        <Image src="/events/programs/16 days of activism.png" alt="16 Days of Activism" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-700 opacity-60" />
                                    </div>
                                    <div className="mt-[200px] md:mt-[260px] relative z-20">
                                        <div className="absolute top-0 right-0 w-80 h-80 bg-sauti-orange/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                        <span className="inline-flex items-center gap-2 md:gap-3 text-[#00cf8d] font-bold mb-4 md:mb-8 text-sm md:text-lg px-4 md:px-6 py-1.5 md:py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                                            <CalendarDays className="w-4 h-4 md:w-6 md:h-6" /> Nov 25 - Dec 10
                                        </span>
                                        <h3 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 group-hover:text-sauti-orange transition-colors">
                                            16 Days of Activism
                                        </h3>
                                        <p className="text-white/70 font-bold mb-4 md:mb-8 text-lg md:text-xl">Advocacy Campaign</p>
                                        <p className="text-white/80 leading-relaxed text-base md:text-lg mb-8 md:mb-10 flex-1">
                                            Mobilizing survivor voices to demand accountability and policy change globally.
                                        </p>
                                        <div className="pt-6 md:pt-10 border-t border-white/10">
                                            <span className="text-white font-black text-lg md:text-xl flex items-center gap-2 md:gap-3 group-hover:text-sauti-orange transition-colors">Join Movement <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-[#00cf8d]"/></span>
                                        </div>
                                    </div>
                                </div>
                             </Link>
                        </div>
                    </div>
                </section>

                {/* 7. FAQ Section */}
				<div className="py-24 bg-[#fefefe]">
					<div className="container px-4">
						<div className="max-w-4xl mx-auto">
							<div className="text-center mb-20 relative">
								<h2 className="text-5xl md:text-7xl font-black text-sauti-blue relative z-10">
                                    Help <CircledText circleColor="#00cf8d">Center</CircledText>
                                </h2>
							</div>
							<AccordionFAQs />
						</div>
					</div>
				</div>

                
				<div className="bg-[#00473e] py-20">
					<Footer />
				</div>
			</main>
		</div>
	);
}

function ServiceCard({ icon, title, description, slug, theme = 'teal' }: { icon: React.ReactNode, title: string, description: string, slug: string, theme?: 'teal' | 'yellow' | 'red' }) {
    const bgMap = {
        teal: 'hover:bg-sauti-light-teal/50',
        yellow: 'hover:bg-sauti-light-yellow/50',
        red: 'hover:bg-sauti-light-red/50'
    };
    const borderMap = {
        teal: 'hover:border-sauti-teal/30',
        yellow: 'hover:border-sauti-yellow/30',
        red: 'hover:border-sauti-red/30'
    };

	return (
		<motion.div 
			whileHover={{ y: -12, boxShadow: "0 40px 60px -15px rgba(0,0,0,0.1)" }}
			className={`bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 border border-gray-100 flex flex-col gap-4 md:gap-6 group transition-all ${bgMap[theme]} ${borderMap[theme]}`}
		>
			<div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-[20px] md:rounded-[24px] bg-gray-50 mb-2 md:mb-4 group-hover:bg-white transition-colors shadow-sm">
				{icon}
			</div>
			<h3 className="text-2xl md:text-3xl font-bold text-sauti-dark group-hover:text-black transition-colors">{title}</h3>
			<p className="text-gray-600 text-base md:text-lg leading-relaxed">{description}</p>
			<Link href={`/programs/${slug}`} className="mt-auto pt-4 md:pt-6 flex items-center gap-2 text-sauti-dark font-bold text-lg group-hover:underline">
				Explore <ArrowRight className="w-5 h-5" />
			</Link>
		</motion.div>
	);
}

function FeatureRow({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
     return (
        <div className="flex gap-4 md:gap-6 items-start">
             <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-[16px] md:rounded-[20px] bg-white border border-gray-100 flex items-center justify-center shadow-lg text-sauti-dark">
                 {icon}
             </div>
             <div>
                 <h3 className="text-xl md:text-2xl font-bold text-sauti-dark mb-1 md:mb-2">{title}</h3>
                 <p className="text-gray-500 text-base md:text-lg leading-relaxed">{description}</p>
             </div>
        </div>
     );
}

function StatCompact({ value, label }: { value: string, label: string }) {
    return (
        <div>
            <div className="text-4xl md:text-7xl font-black text-sauti-dark mb-1 md:mb-2">{value}</div>
            <div className="text-gray-500 text-xs md:text-lg font-bold tracking-widest uppercase">{label}</div>
        </div>
    );
}
