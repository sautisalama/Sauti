"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heart, Scale, Shield, Landmark, ArrowRight, BookOpen } from "lucide-react";

export default function ProgramsPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main className="flex-1">
				<section className="py-12 md:py-24 lg:py-32">
					<div className="container px-4 max-w-7xl mx-auto">
                        <div className="mb-12 md:mb-24 max-w-3xl">
                             <div className="inline-block rounded-full px-4 py-1 text-xs md:text-sm font-bold bg-sauti-orange/10 text-sauti-orange mb-4 md:mb-6 uppercase tracking-wider">
								Our Interventions
							</div>
                            <div className="relative w-fit mb-8 md:mb-12">
                                <motion.h1 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-3xl md:text-5xl lg:text-7xl font-serif font-bold text-sauti-blue leading-tight relative z-10"
                                >
                                    Structural Change requires systemic action.
                                </motion.h1>
                            </div>
                            <p className="text-lg md:text-2xl text-gray-600 leading-relaxed font-light">
                                We don't just respond to violence; we build the ecosystems necessary for prevention, justice, and long-term healing.
                            </p>
                        </div>

						<div className="space-y-24 md:space-y-40">
							<ProgramSection 
								number="01"
								icon={<Heart className="w-10 h-10" />}
								title="Access to Care & Support"
								subtitle="Psychosocial, Medical, and Shelter Pathways"
								description="We strengthen referral pathways to ensure survivors can access trauma-informed care without delay or discrimination. By partnering with local health providers and shelters, we bridge the gap between initial reporting and long-term recovery."
                                image="/events/impact/Community -Letu.png"
                                slug="access-to-care"
                                benefits={[
                                    "Trauma-informed counselling networks",
                                    "Emergency medical referrals",
                                    "Safe housing coordination"
                                ]}
							/>
							<ProgramSection 
								number="02"
								icon={<Shield className="w-10 h-10" />}
								title="Community Prevention"
								subtitle="Collective Responsibility & Safety"
								description="Violence prevention starts with community ownership. We work with young people, caregivers, and local leaders to challenge harmful norms and build 'Circles of Safety' that protect the most vulnerable."
                                image="/events/impact/Learning Program - 748 registered learners.png"
                                slug="prevention"
                                benefits={[
                                    "Youth-led bystander intervention training",
                                    "Community dialogues on consent",
                                    "Safety mapping workshops"
                                ]}
							/>
							<ProgramSection 
								number="03"
								icon={<Scale className="w-10 h-10" />}
								title="Legal Access & Advocacy"
								subtitle="Justice That Serves Survivors"
								description="Navigating the justice system is often re-traumatising. We provide legal literacy, accompaniment, and advocacy to ensure that laws are not just written but felt in the lives of women and girls."
                                image="/events/impact/at cop29.png"
                                slug="legal-access"
                                benefits={[
                                    "Pro-bono legal representation",
                                    "Rights awareness campaigns",
                                    "Policy advocacy for survivor protection"
                                ]}
							/>
							<ProgramSection 
								number="04"
								icon={<Landmark className="w-10 h-10" />}
								title="Feminist Tech"
								subtitle="Digital Tools for Safety"
								description="Sauti Salama designs and maintains digital tools that expand access to care and information while prioritising consent, safety, and accountability."
                                image="/events/impact/startegic plan meeting.png"
                                slug="feminist-tech"
                                benefits={[
                                    "Secure reporting platforms",
                                    "Digital hygiene training",
                                    "Data privacy advocacy"
                                ]}
							/>
							<ProgramSection 
								number="05"
								icon={<BookOpen className="w-10 h-10" />}
								title="Capacity Building"
								subtitle="Learning Program & Resources"
								description="Empowerment through knowledge. Our integrated learning program provides survivors and community members with the tools, courses, and certifications needed to build a safer future."
                                image="/events/impact/Learning Program - 748 registered learners.png"
                                customLink="/learn"
                                benefits={[
                                    "AI for Social Impact courses",
                                    "Survivor-led facilitator training",
                                    "Resource library access"
                                ]}
							/>
						</div>
					</div>
				</section>
                
                <section className="bg-[#f4f7fa] py-12 md:py-24">
                     <div className="container px-4 max-w-5xl mx-auto text-center">
                        <h2 className="text-2xl md:text-5xl font-bold text-sauti-blue mb-8 md:mb-12 relative inline-block px-6 font-serif">
                            Comprehensive approach to Safety.
                        </h2>
                        <p className="text-lg md:text-xl text-gray-600 mb-10 md:mb-16 max-w-3xl mx-auto leading-relaxed">
                            Our programs are interconnected, ensuring that survivors are supported both psychosocially and legally.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
                            <Link href="/volunteer">
                                <Button className="rounded-full bg-sauti-blue text-white px-8 md:px-10 py-6 md:py-8 text-lg font-bold shadow-xl hover:bg-sauti-blue/90 transition-all">
                                    Join Our Collective
                                </Button>
                            </Link>
                            <Link href="/signup">
                                <Button variant="outline" className="rounded-full border-2 border-sauti-blue text-sauti-blue px-8 md:px-10 py-6 md:py-8 text-lg font-bold hover:bg-sauti-blue hover:text-white transition-all">
                                    Visit the Sauti App
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

function ProgramSection({ number, icon, title, subtitle, description, benefits, image, slug, customLink }: { number: string, icon: React.ReactNode, title: string, subtitle: string, description: string, benefits: string[], image?: string, slug?: string, customLink?: string }) {
	return (
		<div id={slug} className="grid lg:grid-cols-2 gap-12 md:gap-16 lg:gap-32 items-center group scroll-mt-32">
			<div className="relative">
				<div className="text-5xl md:text-9xl font-black text-gray-100 absolute -top-8 md:-top-24 -left-2 md:-left-10 -z-10 select-none">
					{number}
				</div>
				<h3 className="text-2xl md:text-4xl lg:text-6xl font-bold text-sauti-blue mb-4 md:mb-6">{title}</h3>
				<p className="text-lg md:text-2xl text-sauti-orange font-bold mb-6 md:mb-10">{subtitle}</p>
				<div className="p-6 md:p-10 bg-gray-50 rounded-[32px] md:rounded-[60px] relative overflow-hidden mb-8 md:mb-12">
					<div className="text-sauti-blue mb-6 md:mb-8">{icon}</div>
					<p className="text-base md:text-xl text-gray-700 leading-relaxed font-medium">
						{description}
					</p>
				</div>
				<div className="flex flex-wrap gap-4">
					<Link href={customLink || `/programs/${slug}`}>
						<Button className="rounded-full bg-[#ebc13d] text-[#00473e] px-6 md:px-10 py-4 md:py-8 text-base md:text-xl font-black group shadow-xl hover:bg-[#d4ac31] transition-all">
							Learn More
							<ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
						</Button>
					</Link>
					<Link href="/signup">
						<Button variant="outline" className="rounded-full border-2 border-sauti-blue text-sauti-blue px-6 md:px-10 py-4 md:py-8 text-base md:text-xl font-black hover:bg-sauti-blue hover:text-white transition-all">
							Use the App
						</Button>
					</Link>
				</div>
			</div>
			<div className="relative">
				{image && (
					<div className="rounded-tr-[60px] md:rounded-tr-[120px] rounded-bl-[60px] md:rounded-bl-[120px] rounded-tl-[24px] md:rounded-tl-[40px] rounded-br-[24px] md:rounded-br-[40px] overflow-hidden shadow-2xl mb-8 md:mb-12 aspect-[4/3] relative group-hover:scale-[1.02] transition-transform duration-700">
						<Image src={image} alt={title} fill className="object-cover" />
					</div>
				)}
				<h4 className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 md:mb-8">Key Components</h4>
				<ul className="space-y-4 md:space-y-6">
					{benefits.map((benefit, i) => (
						<li key={i} className="flex items-center gap-3 md:gap-6 p-3 md:p-4 rounded-2xl md:rounded-3xl hover:bg-gray-50 transition-colors border-b border-gray-100">
							<div className="w-8 h-8 md:w-14 md:h-14 rounded-full bg-sauti-blue text-white flex items-center justify-center font-bold shadow-lg shrink-0">
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
