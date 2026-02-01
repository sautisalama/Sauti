"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import { 
    UsersRound, 
    Search, 
    HeartHandshake,
    CheckCircle2,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { CircledText } from "@/components/ui/CircledText";

export default function AboutPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main className="flex-1">
				<section className="pt-12 pb-16 md:pt-16 md:pb-32">
					<div className="container mx-auto px-4 md:px-16 lg:px-32 max-w-[1400px]">
						<div className="text-left mb-12 md:mb-20">
							<h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-blue">
								Our <CircledText circleColor="#F4B400">Story</CircledText>
							</h2>
						</div>

						<div className="bg-[#f4f7fa] rounded-[32px] md:rounded-[60px] p-6 md:p-12 lg:p-24 relative overflow-hidden mb-12 md:mb-32">
							<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start relative z-10">
								<div>
									<h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-sauti-dark mb-6 md:mb-10 leading-[1.05]">
										2 women killed daily <br/>
										<span className="text-sauti-red relative inline-block">
											as of 2025.
										</span>
									</h1>
									<p className="text-lg md:text-2xl text-gray-700 leading-relaxed font-medium max-w-xl">
										Sauti is founded in response to gaps in care, safety, and justice. Our work emerged from community organising where it became clear many navigate harm alone.
									</p>
								</div>
								<div className="flex flex-col gap-8 md:gap-12">
									<FeatureRow 
										icon={<UsersRound className="w-6 h-6 md:w-8 md:h-8 text-sauti-blue" />} 
										title="Collective Care" 
										description="Care is central to justice. We thrive when we support one another." 
									/>
									<FeatureRow 
										icon={<Search className="w-6 h-6 md:w-8 md:h-8 text-sauti-blue" />} 
										title="Accountability" 
										description="We prioritise safe practice and learning over public recognition." 
									/>
									<FeatureRow 
										icon={<HeartHandshake className="w-6 h-6 md:w-8 md:h-8 text-sauti-blue" />} 
										title="Human-Centered" 
										description="Technology supports response; it does not replace human connection." 
									/>
								</div>
							</div>

							<div className="flex flex-wrap gap-8 md:gap-32 mt-12 md:mt-24 pt-8 md:pt-16 border-t border-gray-200/60">
								<StatCompact value="500+" label="Survivors" />
                                <Link href="/learn" className="hover:opacity-80 transition-opacity">
								    <StatCompact value="1000+" label="Educated" />
                                </Link>
								<StatCompact value="95%" label="Accuracy" />
                                <Link href="/programs" className="hover:opacity-80 transition-opacity">
                                    <StatCompact value="10+" label="Programs" />
                                </Link>
							</div>
						</div>

						{/* Our Team Section */}
						{/* <div className="mb-12 md:mb-32">
							<div className="text-left mb-12 md:mb-20 relative">
								<h2 className="text-3xl md:text-5xl lg:text-7xl font-bold text-sauti-blue relative z-10">Our Team</h2>
								<p className="text-lg md:text-2xl text-gray-500 max-w-3xl font-medium mt-4 md:mt-6">
									Led by young women and youth, supported by a multidisciplinary team.
								</p>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
								{[
									{ name: "Sauti Leader", role: "Founding Director", bio: "Leading with vision to bridge gaps in justice." },
									{ name: "Grace W.", role: "Programs Lead", bio: "Coordinating community-led response systems." },
									{ name: "David K.", role: "Legal Advocacy", bio: "Improving legal literacy for structural change." },
									{ name: "Sarah M.", role: "Tech for Good", bio: "Designing digital tools focusing on consent." },
									{ name: "John P.", role: "Collective Care", bio: "Building local response networks." },
									{ name: "Elena R.", role: "Operations", bio: "Ensuring ethical practice and safeguarding." }
								].map((member, i) => (
									<div key={i} className="group bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-8 border border-gray-100 shadow-xl hover:shadow-2xl transition-all">
										<div className="w-full aspect-square rounded-[20px] md:rounded-[32px] bg-gray-100 mb-6 md:mb-8 overflow-hidden relative">
                                            <Image 
                                                src={`https://i.pravatar.cc/400?u=${i + 80}`} 
                                                alt={member.name} 
                                                fill 
                                                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                            />
                                        </div>
										<h3 className="text-2xl md:text-3xl font-bold text-sauti-blue mb-1">{member.name}</h3>
										<p className="text-sauti-orange font-bold uppercase tracking-widest text-xs md:text-sm mb-3 md:mb-4">{member.role}</p>
										<p className="text-gray-500 text-base md:text-lg leading-relaxed">{member.bio}</p>
									</div>
								))}
							</div>
						</div> */}

						{/* Impact Visuals */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 lg:gap-40 items-start max-w-7xl mx-auto px-4">
							{/* Beneficiaries */}
							<Link href="/learn" className="group flex flex-col gap-6 md:gap-8">
								<div className="rounded-[32px] md:rounded-[48px] overflow-hidden bg-gray-100 aspect-[4/3] relative shadow-lg hover:shadow-2xl transition-shadow duration-500">
									<Image 
										src="/dashboard/activism-image-woman-with-megaphone.png"
										alt="Youth activism"
										fill
										className="object-cover group-hover:scale-105 transition-transform duration-700"
									/>
								</div>
								<div>
									<div className="text-4xl md:text-6xl font-black text-sauti-blue mb-2">1,000+</div>
									<div className="text-xl md:text-3xl font-bold text-gray-800 mb-2 group-hover:text-sauti-orange transition-colors flex items-center gap-2">
                                        Educated <ArrowRight className="w-6 h-6"/>
                                    </div>
									<p className="text-base md:text-lg text-gray-500 max-w-md">People joined our leadership programs across Kenya.</p>
								</div>
							</Link>

							{/* Programs */}
							<Link href="/programs" className="group flex flex-col gap-6 md:gap-8 lg:mt-32">
								<div className="rounded-[32px] md:rounded-[48px] overflow-hidden bg-gray-100 aspect-[4/3] relative shadow-lg hover:shadow-2xl transition-shadow duration-500">
									<Image 
										src="/dashboard/featured.png"
										alt="Community programs"
										fill
										className="object-cover group-hover:scale-105 transition-transform duration-700"
									/>
								</div>
								<div>
									<div className="text-4xl md:text-6xl font-black text-sauti-blue mb-2">10+</div>
									<div className="text-xl md:text-3xl font-bold text-gray-800 mb-2 group-hover:text-sauti-orange transition-colors flex items-center gap-2">
                                        Active Programs <ArrowRight className="w-6 h-6"/>
                                    </div>
									<p className="text-base md:text-lg text-gray-500 max-w-md">Ongoing initiatives focusing on climate and community care.</p>
								</div>
							</Link>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
}

function FeatureRow({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
     return (
        <div className="flex gap-4 md:gap-6">
             <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white border border-gray-100 flex items-center justify-center shadow-lg">
                 {icon}
             </div>
             <div>
                 <h3 className="text-xl md:text-2xl font-bold text-sauti-blue mb-1 md:mb-2">{title}</h3>
                 <p className="text-gray-500 text-sm md:text-lg leading-relaxed">{description}</p>
             </div>
        </div>
     );
}

function StatCompact({ value, label }: { value: string, label: string }) {
    return (
        <div>
            <div className="text-3xl md:text-7xl font-black text-sauti-blue mb-1 md:mb-2">{value}</div>
            <div className="text-gray-500 text-[10px] md:text-lg font-bold uppercase tracking-wider">{label}</div>
        </div>
    );
}
