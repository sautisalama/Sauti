"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Video, FileText, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircledText } from "@/components/ui/CircledText";

export default function LearnPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1">
				<section className="py-12 md:py-24 lg:py-32">
					<div className="container px-4 max-w-7xl mx-auto text-left">
                        <div className="mb-12 md:mb-20">
                            <h1 className="text-3xl md:text-5xl lg:text-8xl font-black text-sauti-dark leading-tight relative z-10">
                                Knowledge is <CircledText circleColor="#F4B400">Power</CircledText>.
                            </h1>
                        </div>

                        {/* Recent AI Course Featured */}
                        <div className="bg-sauti-dark rounded-[32px] md:rounded-[60px] p-6 md:p-12 lg:p-16 text-white mb-12 md:mb-24 relative overflow-hidden group shadow-3xl">
                            <div className="absolute top-0 right-0 w-1/2 h-full bg-sauti-yellow/5 -skew-x-12 translate-x-1/2" />
                            <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center relative z-10">
                                <div className="order-2 lg:order-1">
                                    <span className="inline-flex items-center gap-2 px-4 py-1 md:py-2 rounded-full bg-white/10 text-sauti-yellow text-xs md:text-sm font-bold mb-4 md:mb-8 uppercase tracking-wider">
                                        <Play className="w-3 h-3 md:w-4 md:h-4" /> Recent Course
                                    </span>
                                    <h2 className="text-2xl md:text-4xl lg:text-6xl font-bold mb-4 md:mb-8">AI for Impact</h2>
                                    <p className="text-base md:text-xl text-white/70 mb-6 md:mb-10 leading-relaxed font-medium">
                                        Learn how to leverage AI to expand access to care while maintaining strict safety and consent standards.
                                    </p>
                                    <Link href="/impact/capacity-building">
                                        <Button className="rounded-full bg-sauti-yellow text-sauti-dark px-6 md:px-10 py-5 md:py-8 text-base md:text-xl font-black shadow-xl hover:scale-105 transition-transform hover:bg-sauti-yellow/90">
                                            Start Learning
                                            <ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6" />
                                        </Button>
                                    </Link>
                                </div>
                                <div className="order-1 lg:order-2">
                                    <div className="rounded-[24px] md:rounded-[40px] overflow-hidden aspect-[4/3] bg-white/10 relative shadow-2xl border-4 border-white/10">
                                        <Image 
                                            src="/events/programs/AI course.png" 
                                            alt="Visual representation of AI for Impact course modules" 
                                            fill 
                                            className="object-cover group-hover:scale-105 transition-transform duration-700" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
							<LearnCard 
                                image="/dashboard/activism-image-woman-with-megaphone.png"
                                date="12 Dec, 2025"
                                category="Survival Skills"
                                title="Reporting & Personal Safety"
                                description="Comprehensive guide on how to use Sauti tools for discreet reporting."
                                href="/impact/platform"
                            />
							<LearnCard 
                                image="/dashboard/featured.png"
                                date="24 Dec, 2025"
                                category="Advocacy"
                                title="Legal Literacy for Survivors"
                                description="Understanding your rights within the Kenyan legal framework."
                                href="/impact/advocacy-and-justice"
                            />
							<LearnCard 
                                image="/dashboard/activism-image-woman-with-megaphone.png"
                                date="02 Jan, 2026"
                                category="Community"
                                title="Collective Care Models"
                                description="Building community resilience through shared responsibility."
                                href="/impact/survivor-cafe"
                            />
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
}

function LearnCard({ image, date, category, title, description, href }: { image: string, date: string, category: string, title: string, description: string, href: string }) {
    return (
        <Link href={href} className="group">
            <article className="h-full">
                <div className="aspect-[16/10] relative rounded-[24px] md:rounded-[40px] overflow-hidden mb-4 md:mb-8 bg-white shadow-xl border-2 border-gray-50 group-hover:shadow-2xl transition-all duration-500">
                    <Image src={image} alt={title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute top-4 md:top-6 left-4 md:left-6 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-white/95 backdrop-blur-sm text-sauti-dark text-[10px] md:text-sm font-black uppercase tracking-widest shadow-sm">
                        {category}
                    </div>
                </div>
                <div className="px-2 md:px-4">
                    <div className="text-xs md:text-sm text-sauti-yellow font-bold uppercase mb-2 md:mb-3 tracking-widest">{date}</div>
                    <h3 className="text-xl md:text-3xl font-bold text-sauti-dark mb-2 md:mb-4 leading-tight group-hover:text-sauti-yellow transition-colors line-clamp-2">
                        {title}
                    </h3>
                    <p className="text-gray-500 text-sm md:text-lg leading-relaxed line-clamp-2 font-medium">
                        {description}
                    </p>
                    <div className="mt-4 md:mt-8 flex items-center gap-2 md:gap-3 text-sauti-dark font-black text-base md:text-lg group-hover:gap-4 transition-all">
                        Access <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-sauti-yellow" />
                    </div>
                </div>
            </article>
        </Link>
    );
}
