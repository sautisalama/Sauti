"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { CircledText } from "@/components/ui/CircledText";

export default function ImpactPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1">
				{/* Full-Width Hero - Gradient overlay for text contrast */}
				<section className="relative min-h-[80vh] flex items-start pt-16 md:pt-24 overflow-hidden">
					{/* Background Image */}
					<div className="absolute inset-0 z-0">
						<Image
							src="/impact-image.png"
							alt="Group of people participating in community impact session"
							fill
							className="object-cover"
							priority
						/>
					</div>

					{/* Gradient Overlay - Only where text is (top portion) */}
					<div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-[1]" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.3) 60%, transparent 80%)' }} />

					<div className="container mx-auto px-4 md:px-12 max-w-[1400px] relative z-10">
						<div className="text-center max-w-5xl mx-auto">
							<span className="inline-flex px-6 py-2 rounded-full bg-sauti-yellow text-sauti-dark text-xs md:text-sm font-bold mb-6 uppercase tracking-wider shadow-xl">
								Measured in Lives Changed
							</span>
							<h1 className="text-4xl md:text-6xl lg:text-8xl font-black text-white leading-tight mb-6 drop-shadow-2xl">
								Real Impact.<br/>Real <CircledText circleColor="#F4B400">Stories</CircledText>.
							</h1>
							<p className="text-white text-lg md:text-2xl leading-relaxed mb-10 max-w-3xl mx-auto font-light drop-shadow-xl">
								From connecting 500+ survivors to care, to influencing national policy—every number represents a life transformed.
							</p>

							{/* Inline Stats - No backgrounds, crowded */}
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
								<div className="flex flex-col items-center">
									<div className="text-4xl md:text-6xl font-black text-sauti-yellow mb-2 drop-shadow-lg">500+</div>
									<div className="text-white font-bold uppercase tracking-widest text-[10px] md:text-xs drop-shadow-md">Survivors Reached</div>
								</div>
								<div className="flex flex-col items-center">
									<div className="text-4xl md:text-6xl font-black text-sauti-yellow mb-2 drop-shadow-lg">1000+</div>
									<div className="text-white font-bold uppercase tracking-widest text-[10px] md:text-xs drop-shadow-md">Educated</div>
								</div>
								<div className="flex flex-col items-center">
									<div className="text-4xl md:text-6xl font-black text-sauti-yellow mb-2 drop-shadow-lg">95%</div>
									<div className="text-white font-bold uppercase tracking-widest text-[10px] md:text-xs drop-shadow-md">Impact Rate</div>
								</div>
								<div className="flex flex-col items-center">
									<div className="text-4xl md:text-6xl font-black text-sauti-yellow mb-2 drop-shadow-lg">10+</div>
									<div className="text-white font-bold uppercase tracking-widest text-[10px] md:text-xs drop-shadow-md">Active Programs</div>
								</div>
							</div>
						</div>
					</div>
				</section>

                {/* Initiatives in Action Grid - PRIMARY FOCUS */}
                <section className="py-12 md:py-20 lg:py-32 bg-white border-t border-gray-100">
                    <div className="container px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
                        <div className="text-center mb-12 md:mb-16 lg:mb-24">
                            <span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-3 md:mb-4 block">Deep Dive</span>
                            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-sauti-dark mb-4 md:mb-6 px-4">Impact in Action</h2>
                            <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto px-4">
                                Explore the stories, initiatives, and movements driving tangible change in our communities.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 auto-rows-[280px] md:auto-rows-[300px]">
                            {/* 1. Platform - Large Hero Feature */}
                            <div className="md:col-span-2 md:row-span-2">
                                <ImpactCard 
                                    title="The Sauti Platform"
                                    category="Technology"
                                    image="/platform/sauti salama - survivor dashboard - desktop.png"
                                    link="/impact/platform"
                                    className="h-full"
                                    largeTitle
                                    description="Connecting 500+ survivors to vetted professionals through secure, anonymous reporting"
                                />
                            </div>

                            {/* 2. COP30 - Tall Feature */}
                            <div className="md:row-span-2">
                                <ImpactCard 
                                    title="Sauti Salama at COP30"
                                    category="Global Advocacy"
                                    image="/events/impact/at cop30.png"
                                    link="/impact/cop-30"
                                    className="h-full"
                                    description="Bringing gendered climate harm to the forefront of global policy at COP30 in Brazil"
                                />
                            </div>

                            {/* 3. Survivor Cafe */}
                            <ImpactCard 
                                title="Survivor Cafe"
                                category="Safe Spaces"
                                image="/events/programs/survivors cafe program.png"
                                link="/impact/survivor-cafe"
                                className="h-full"
                                description="An online sanctuary merging peer support with professional mental health resources"
                            />

                            {/* 4. End Femicide */}
                            <ImpactCard 
                                title="End Femicide KE"
                                category="Movement"
                                image="/events/impact/end femicide march.jpeg"
                                link="/impact/end-femicide"
                                className="h-full"
                                description="From 2024's historic marches to the 2025 Presidential Task Force on femicide"
                            />

                            {/* 5. Capacity Building */}
                            <ImpactCard 
                                title="Capacity Building"
                                category="Education"
                                image="/events/impact/malkia teaching child.jpeg"
                                link="/impact/capacity-building"
                                className="h-full"
                                description="Empowering 748+ learners with AI skills and digital literacy for financial independence"
                            />

                            {/* 6. 16 Days - Wide filler if needed, or just standard */}
                            <div className="md:col-span-3">
                                 <ImpactCard 
                                    title="16 Days of Activism"
                                    category="Campaign"
                                    image="/events/impact/16-days of activism 2.jpeg"
                                    link="/impact/16-days-of-activism"
                                    className="h-full"
                                    description="Our most intensive annual campaign, focusing on ending digital violence against women and girls"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Brief Approach Section - Enhanced */}
                <section className="py-12 md:py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-white">
                    <div className="container px-4 md:px-6 lg:px-8 max-w-5xl mx-auto text-center">
                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-sauti-dark mb-4 md:mb-6">How We Create Change</h2>
                        <p className="text-base md:text-lg lg:text-xl text-gray-600 leading-relaxed mb-8 md:mb-12 max-w-3xl mx-auto">
                            Every initiative is rooted in survivor-led evidence, community ownership, and systems-level advocacy. We don't just respond to harm—we build the infrastructure for prevention, justice, and healing.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                            <div className="bg-gradient-to-br from-sauti-teal/5 to-sauti-teal/10 p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 border-sauti-teal/20 hover:border-sauti-teal/40 transition-all hover:shadow-xl group">
                                <div className="w-12 h-12 md:w-14 md:h-14 bg-sauti-teal rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                                </div>
                                <div className="font-black text-sauti-dark mb-2 md:mb-3 text-lg md:text-xl">Survivor-Led</div>
                                <p className="text-gray-600 leading-relaxed text-sm md:text-base">Lived experience guides every decision. Survivors aren't just beneficiaries—they're architects of change.</p>
                            </div>
                            <div className="bg-gradient-to-br from-sauti-yellow/5 to-sauti-yellow/10 p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 border-sauti-yellow/30 hover:border-sauti-yellow/50 transition-all hover:shadow-xl group">
                                <div className="w-12 h-12 md:w-14 md:h-14 bg-sauti-yellow rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-sauti-dark" />
                                </div>
                                <div className="font-black text-sauti-dark mb-2 md:mb-3 text-lg md:text-xl">Data-Driven</div>
                                <p className="text-gray-600 leading-relaxed text-sm md:text-base">We track outcomes, not just outputs. Real-time dashboards ensure transparency and accountability.</p>
                            </div>
                            <div className="bg-gradient-to-br from-sauti-red/5 to-sauti-red/10 p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 border-sauti-red/20 hover:border-sauti-red/40 transition-all hover:shadow-xl group">
                                <div className="w-12 h-12 md:w-14 md:h-14 bg-sauti-red rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                                </div>
                                <div className="font-black text-sauti-dark mb-2 md:mb-3 text-lg md:text-xl">Systems-Level</div>
                                <p className="text-gray-600 leading-relaxed text-sm md:text-base">From local courts to COP30—we shift policy, not just mindsets. Change must be structural.</p>
                            </div>
                        </div>
                    </div>
                </section>
			</main>
			<Footer />
		</div>
	);
}

function ImpactCard({ title, category, image, link, className, largeTitle, description }: { 
    title: string, 
    category: string, 
    image: string, 
    link: string, 
    className?: string, 
    largeTitle?: boolean,
    description?: string 
}) {
    // Determine category color
    const getCategoryColor = (cat: string) => {
        if (cat.includes('Technology')) return 'from-sauti-teal/80 to-sauti-teal/60';
        if (cat.includes('Global') || cat.includes('Advocacy')) return 'from-sauti-yellow/80 to-sauti-yellow/60';
        if (cat.includes('Safe') || cat.includes('Spaces')) return 'from-purple-500/80 to-purple-400/60';
        if (cat.includes('Movement')) return 'from-sauti-red/80 to-sauti-red/60';
        if (cat.includes('Education')) return 'from-blue-500/80 to-blue-400/60';
        if (cat.includes('Campaign')) return 'from-sauti-yellow/80 to-orange-400/60';
        return 'from-sauti-dark/80 to-sauti-dark/60';
    };

    return (
        <Link href={link} className={`group block overflow-hidden rounded-[24px] md:rounded-[32px] ${className}`}>
            <div className="bg-white h-full relative overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
                {/* Image fills the card */}
                <Image 
                    src={image} 
                    alt={title} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-700 brightness-90" 
                />
                 {/* Vibrant gradient overlay - clear top-right, colored bottom-left */}
                <div 
                    className={`absolute inset-0 opacity-70 group-hover:opacity-80 transition-opacity`}
                    style={{
                        background: `radial-gradient(circle at top right, transparent 0%, transparent 30%, ${
                            category.includes('Technology') ? 'rgba(0, 207, 141, 0.8)' :
                            category.includes('Global') || category.includes('Advocacy') ? 'rgba(244, 180, 0, 0.8)' :
                            category.includes('Safe') || category.includes('Spaces') ? 'rgba(168, 85, 247, 0.8)' :
                            category.includes('Movement') ? 'rgba(239, 68, 68, 0.8)' :
                            category.includes('Education') ? 'rgba(59, 130, 246, 0.8)' :
                            category.includes('Campaign') ? 'rgba(251, 146, 60, 0.8)' :
                            'rgba(26, 54, 93, 0.8)'
                        } 100%)`
                    }}
                />

                <div className="absolute inset-0 p-4 md:p-6 lg:p-8 flex flex-col justify-end">
                     <div className="inline-flex self-start px-2 py-1 md:px-3 md:py-1 rounded-full bg-white/90 backdrop-blur-sm text-sauti-dark text-[10px] md:text-xs font-bold uppercase tracking-wider mb-3 md:mb-4 shadow-lg">
                        {category}
                    </div>
                    <h3 className={`${largeTitle ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-xl md:text-2xl lg:text-3xl'} font-black text-white mb-2 md:mb-3 leading-tight drop-shadow-lg`}>
                        {title}
                    </h3>
                     
                     {description && (
                        <p className="text-white/90 text-xs md:text-sm lg:text-base leading-relaxed mb-3 md:mb-4 line-clamp-2 drop-shadow-md">
                            {description}...
                        </p>
                     )}
                     
                     <div className="flex items-center text-white font-bold text-xs md:text-sm uppercase tracking-wider mt-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        Read Full Story <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 ml-2" />
                    </div>
                </div>
            </div>
        </Link>
    )
}
