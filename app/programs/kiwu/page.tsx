"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import {
	Droplets,
	Sun,
	Truck,
	Handshake,
	BarChart3,
	CheckCircle2,
	Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircledText } from "@/components/ui/CircledText";

export default function KiwuPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1">
				{/* Hero Section */}
				<section className="pt-24 pb-16 md:py-32 bg-[#ecfeff]">
					<div className="container mx-auto px-6 max-w-7xl">
						<div className="grid lg:grid-cols-2 gap-16 items-center">
							<div>
								<span className="inline-block px-4 py-1 rounded-full bg-sauti-yellow/10 text-sauti-yellow text-sm font-bold mb-6 uppercase tracking-widest">
									Program: Climate Resilience &amp; WASH
								</span>
								<h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-sauti-dark mb-6 md:mb-8 leading-tight">
									Climate-Resilient{" "}
									<CircledText circleColor="#00CF8D">Water</CircledText> Systems
								</h1>
								<p className="text-lg md:text-xl lg:text-2xl text-gray-600 leading-relaxed mb-8 md:mb-10 font-medium">
									Kiwu builds decentralized water systems that bring safe,
									affordable water closer to communities in Kenya&apos;s
									drylands — starting in Mwingi, Kitui County.
								</p>
								<div className="flex flex-wrap gap-4">
									<Link href="mailto:info@sautisalama.org">
										<Button className="rounded-full bg-sauti-yellow text-sauti-dark px-8 py-7 text-lg font-black shadow-xl hover:bg-sauti-yellow/90 transition-all">
											<Mail className="w-5 h-5 mr-2" /> Partner With Kiwu
										</Button>
									</Link>
									<Link href="/volunteer">
										<Button
											variant="outline"
											className="rounded-full border-2 border-sauti-dark text-sauti-dark px-8 py-7 text-lg font-black hover:bg-sauti-dark hover:text-white transition-all"
										>
											Get Involved
										</Button>
									</Link>
								</div>
							</div>
							<div className="relative aspect-square md:aspect-[4/3] rounded-[60px] overflow-hidden shadow-3xl">
								<Image
									src="/Kiwu Water lorry.png"
									alt="Kiwu water distribution in Mwingi, Kitui County"
									fill
									className="object-cover"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-sauti-blue/20 to-transparent" />
							</div>
						</div>
					</div>
				</section>

				{/* Overview */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="max-w-4xl mx-auto space-y-6 text-base md:text-lg text-gray-600 leading-relaxed">
							<p>
								Across Kenya&apos;s ASAL counties, climate change is making
								water increasingly difficult to access. Families spend hours
								searching for water, transport costs continue to rise, and
								communities depend on fragmented supply systems that struggle
								during prolonged droughts.
							</p>
							<p>
								<strong className="text-sauti-dark">
									Kiwu is Sauti Salama&apos;s climate resilience and WASH
									enterprise
								</strong>
								, building decentralized water systems that bring safe,
								affordable water closer to communities. Starting in Mwingi,
								Kitui County, Kiwu combines community water kiosks, clean
								distribution, renewable energy, and local ownership to create
								reliable water access while strengthening climate resilience
								and local livelihoods.
							</p>
							<p>
								Our vision extends beyond delivering water. We are building
								community-owned infrastructure that enables families to spend
								less time searching for water and more time building healthier,
								more resilient futures.
							</p>
						</div>
					</div>
				</section>

				{/* The Challenge */}
				<section className="py-12 md:py-24 bg-sauti-dark text-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
							<div>
								<span className="text-sauti-yellow font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									The Challenge
								</span>
								<h2 className="text-2xl md:text-4xl font-black mb-6 leading-tight">
									Over 19 million Kenyans lack access to safely managed
									drinking water.
								</h2>
								<div className="space-y-5 text-white/70 text-base md:text-lg leading-relaxed">
									<p>
										The greatest burden falls on communities living in Arid and
										Semi-Arid Lands (ASALs). Climate change continues to
										intensify droughts, increasing the distance, time, and cost
										required to secure water.
									</p>
									<p>
										Women and girls carry much of this burden. Time spent
										collecting water often replaces opportunities for
										education, employment, entrepreneurship, and leadership.
									</p>
									<p className="text-white font-bold">
										Communities deserve water systems designed for the
										realities of a changing climate.
									</p>
								</div>
							</div>
							<div className="flex flex-col items-center justify-center p-10 md:p-16 rounded-[32px] md:rounded-[60px] bg-white/5 border border-white/10 text-center">
								<div className="text-6xl md:text-8xl font-black text-sauti-yellow mb-4">
									19M+
								</div>
								<p className="text-white/80 font-bold uppercase tracking-widest text-xs md:text-sm max-w-[260px]">
									Kenyans without access to safely managed drinking water
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Our Solution */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="text-center mb-12 md:mb-16">
							<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-3 block">
								Our Solution
							</span>
							<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-4">
								Decentralized water systems that grow with communities.
							</h2>
							<p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
								Every stage of the model strengthens reliability, affordability,
								and environmental sustainability.
							</p>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
							<SolutionCard
								icon={<Droplets className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Community Water Kiosks"
								description="Community water kiosks that improve local access."
							/>
							<SolutionCard
								icon={<Sun className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Solar-Powered Production"
								description="Solar-powered water production to strengthen long-term resilience."
							/>
							<SolutionCard
								icon={<Truck className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Clean Last-Mile Distribution"
								description="Clean last-mile distribution through electric mobility."
							/>
							<SolutionCard
								icon={<Handshake className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Community-Led Operations"
								description="Community-led operations that create local ownership and accountability."
							/>
							<SolutionCard
								icon={<BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Digital Operations"
								description="Digital operations that improve efficiency, planning, and service delivery."
							/>
						</div>
					</div>
				</section>

				{/* Our Model - Three Phases */}
				<section className="py-12 md:py-24 bg-gray-50">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="text-center mb-12 md:mb-16">
							<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-3 block">
								Our Model
							</span>
							<h2 className="text-2xl md:text-4xl font-black text-sauti-dark">
								Kiwu grows in three phases.
							</h2>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
							<PhaseCard
								phase="Phase One"
								title="Community Water Kiosk"
								description="Our first operational site in Mwingi validates demand while generating recurring revenue through daily water sales."
							/>
							<PhaseCard
								phase="Phase Two"
								title="Clean Last-Mile Distribution"
								description="Electric tuk-tuks powered by solar charging infrastructure increase household access while reducing operating costs and emissions."
							/>
							<PhaseCard
								phase="Phase Three"
								title="Localized Solar-Powered Production"
								description="Community boreholes and solar pumping systems produce water closer to where it is needed, improving affordability and strengthening resilience during drought."
							/>
						</div>
					</div>
				</section>

				{/* Why Kiwu */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
							<div>
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Why Kiwu?
								</span>
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
									Designed around how communities already access water.
								</h2>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed">
									Instead of asking people to change their behaviour, we improve
									the system they already depend on.
								</p>
							</div>
							<ul className="space-y-4">
								{[
									"More reliable access to clean water",
									"Lower long-term operating costs",
									"Climate-resilient infrastructure",
									"Women-led livelihood opportunities",
									"A scalable model for Kenya's ASAL communities",
								].map((item) => (
									<li key={item} className="flex items-start gap-4">
										<CheckCircle2 className="w-6 h-6 text-sauti-teal shrink-0 mt-0.5" />
										<span className="text-base md:text-lg text-gray-700 font-medium">
											{item}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</section>

				{/* Impact Stats */}
				<section className="py-12 md:py-24 bg-sauti-teal">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<h2 className="text-2xl md:text-4xl font-black text-white text-center mb-12 md:mb-16">
							Impact
						</h2>
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 text-center">
							<StatBlock stat="1" label="Community water kiosk operating in Mwingi" />
							<StatBlock stat="400+" label="Households reached" />
							<StatBlock stat="100K+" label="Litres of clean water distributed" />
							<StatBlock stat="Daily" label="Revenue-generating operations validating community demand" />
						</div>
					</div>
				</section>

				{/* Looking Ahead */}
				<section className="py-12 md:py-24 bg-gray-50 border-y border-gray-100">
					<div className="container mx-auto px-4 md:px-12 max-w-4xl text-center">
						<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
							Looking Ahead
						</span>
						<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
							Kiwu is building more than water infrastructure.
						</h2>
						<p className="text-base md:text-lg text-gray-600 leading-relaxed mb-10">
							We are creating a future where climate resilience begins with
							reliable access to one of life&apos;s most essential resources.
							Starting in Mwingi, our ambition is to develop a model that can be
							replicated across Kenya&apos;s water-stressed
							communities—combining clean energy, community ownership, and
							practical engineering to make safe water more affordable,
							accessible, and sustainable.
						</p>
						<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
							<Link href="mailto:info@sautisalama.org">
								<Button className="rounded-full bg-sauti-teal text-white font-black px-8 h-12 hover:bg-sauti-teal/90 shadow-lg flex items-center gap-2">
									<Mail className="w-5 h-5" /> info@sautisalama.org
								</Button>
							</Link>
							<Link href="/programs">
								<Button
									variant="outline"
									className="rounded-full border-2 border-sauti-dark text-sauti-dark font-black px-8 h-12 hover:bg-sauti-dark hover:text-white transition-all"
								>
									Explore All Programs
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

function SolutionCard({
	icon,
	title,
	description,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<div className="p-6 md:p-8 rounded-2xl bg-white border-2 border-gray-50 hover:border-sauti-yellow/20 hover:shadow-2xl transition-all group">
			<div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6 group-hover:bg-sauti-yellow/10 transition-colors">
				{icon}
			</div>
			<h3 className="text-lg md:text-xl font-black text-sauti-blue mb-4 uppercase tracking-tight">
				{title}
			</h3>
			<p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">
				{description}
			</p>
		</div>
	);
}

function PhaseCard({
	phase,
	title,
	description,
}: {
	phase: string;
	title: string;
	description: string;
}) {
	return (
		<div className="p-8 rounded-2xl bg-white border-2 border-gray-100 hover:shadow-xl transition-all">
			<span className="inline-block px-4 py-1.5 rounded-full bg-sauti-yellow/10 text-sauti-yellow text-xs font-bold mb-6 uppercase tracking-widest">
				{phase}
			</span>
			<h3 className="text-lg md:text-xl font-black text-sauti-blue mb-4 uppercase tracking-tight">
				{title}
			</h3>
			<p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">
				{description}
			</p>
		</div>
	);
}

function StatBlock({ stat, label }: { stat: string; label: string }) {
	return (
		<div className="flex flex-col items-center">
			<div className="text-4xl md:text-6xl font-black text-sauti-yellow mb-3">
				{stat}
			</div>
			<div className="text-white/90 font-bold uppercase tracking-wider text-xs md:text-sm max-w-[220px]">
				{label}
			</div>
		</div>
	);
}
