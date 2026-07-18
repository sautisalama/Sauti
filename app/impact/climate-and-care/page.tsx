"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import {
	BookOpen,
	HeartHandshake,
	Sun,
	Users,
	MapPin,
	CheckCircle2,
	Lightbulb,
	ShieldCheck,
	Handshake,
	Mail,
	ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClimateAndCarePage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1">
				{/* Hero */}
				<section className="relative min-h-[70vh] md:min-h-[80vh] flex items-end pb-20 overflow-hidden">
					<Image
						src="/events/impact/climate-care/solar-demo.jpeg"
						alt="Sauti Salama team demonstrating a solar lighting system to community members in Kitui County"
						fill
						className="object-cover"
						priority
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-sauti-dark via-sauti-dark/40 to-transparent" />
					<div className="container mx-auto px-4 md:px-12 max-w-[1400px] relative z-10">
						<div className="max-w-4xl">
							<Link href="/impact">
								<Button variant="ghost" className="text-white hover:bg-white/10 mb-8 rounded-full">
									<ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
								</Button>
							</Link>
							<span className="inline-block px-4 py-1 rounded-full bg-sauti-teal text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
								Climate &amp; Care
							</span>
							<h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-white leading-tight mb-6 drop-shadow-2xl">
								Integrating Care and Climate for GBV Prevention in Kenya
							</h1>
							<p className="text-white text-lg md:text-2xl leading-relaxed max-w-3xl font-light drop-shadow-xl">
								Building climate resilience through clean energy, community
								care, and women&apos;s leadership.
							</p>
						</div>
					</div>
				</section>

				{/* Project Overview */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
							<div>
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Project Overview
								</span>
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
									Climate change affects more than the environment.
								</h2>
								<div className="space-y-5 text-base md:text-lg text-gray-600 leading-relaxed">
									<p>
										In Kenya&apos;s Arid and Semi-Arid Lands (ASALs), climate
										change reshapes how families access water, prepare meals,
										care for children, earn a living, and stay safe. Women and
										girls carry much of this burden through unpaid care work
										while facing increased risks of gender-based violence and
										limited access to clean energy.
									</p>
									<p>
										Sauti Salama&apos;s{" "}
										<strong className="text-sauti-dark">
											Integrating Care and Climate for GBV Prevention in Kenya
										</strong>{" "}
										project responds to these interconnected challenges by
										placing care at the centre of climate action. Implemented in
										Kitui and Isiolo Counties, the project combines climate
										education, women&apos;s economic empowerment, renewable
										energy, and community leadership to strengthen resilience
										while creating safer, healthier households.
									</p>
									<p>
										Supported by Fundación Avina through the International
										Development Research Centre (IDRC), the project demonstrates
										that investments in clean energy can improve household
										wellbeing, reduce environmental impact, and strengthen
										community systems that protect women and girls.
									</p>
								</div>
							</div>
							<div className="relative aspect-[3/4] max-h-[640px] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-2xl">
								<Image
									src="/events/impact/climate-care/women-solar-kits.jpeg"
									alt="Women in Kitui County holding their new household solar lighting systems"
									fill
									className="object-cover"
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Our Approach - Four Pillars */}
				<section className="py-12 md:py-24 bg-gray-50">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="text-center mb-12 md:mb-16">
							<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-3 block">
								Our Approach
							</span>
							<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-4">
								We believe climate resilience begins at home.
							</h2>
							<p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
								Rather than treating climate change, energy access, care work,
								and gender-based violence as separate issues, the project
								addresses them as interconnected realities that shape everyday
								life in ASAL communities.
							</p>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
							<PillarCard
								icon={<BookOpen className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Climate Literacy"
								description="Building community understanding of climate change, adaptation, environmental stewardship, and locally led resilience."
							/>
							<PillarCard
								icon={<HeartHandshake className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Care Systems"
								description="Recognising and strengthening the unpaid care work carried by women and girls while promoting shared responsibility and community support systems."
							/>
							<PillarCard
								icon={<Sun className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Clean Energy"
								description="Increasing access to renewable household energy solutions that improve safety, reduce indoor air pollution, and lower dependence on fossil fuels."
							/>
							<PillarCard
								icon={<Users className="w-6 h-6 md:w-8 md:h-8 text-sauti-yellow" />}
								title="Women's Leadership & Livelihoods"
								description="Supporting women through entrepreneurship training, renewable energy knowledge, and community leadership to strengthen household resilience."
							/>
						</div>
					</div>
				</section>

				{/* Where We Work */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
							<div className="relative aspect-[4/3] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-2xl order-2 lg:order-1">
								<Image
									src="/events/impact/climate-care/community-mobilisation.jpeg"
									alt="Sauti Salama team engaging community members during a renewable energy demonstration"
									fill
									className="object-cover"
								/>
							</div>
							<div className="order-1 lg:order-2">
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Where We Work
								</span>
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6">
									Kitui &amp; Isiolo Counties
								</h2>
								<ul className="space-y-4 mb-8">
									<li className="flex items-start gap-4">
										<MapPin className="w-6 h-6 text-sauti-red shrink-0 mt-1" />
										<span className="text-base md:text-lg text-gray-600 font-medium">
											Tumbuni and Ukasi, Kitui County
										</span>
									</li>
									<li className="flex items-start gap-4">
										<MapPin className="w-6 h-6 text-sauti-red shrink-0 mt-1" />
										<span className="text-base md:text-lg text-gray-600 font-medium">
											Gotu Ward, Isiolo County
										</span>
									</li>
								</ul>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed">
									These communities experience recurrent drought, energy
									poverty, climate-related livelihood challenges, and limited
									access to essential services.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* What We Have Achieved */}
				<section className="py-12 md:py-24 bg-gray-50">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="text-center mb-12 md:mb-16">
							<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-3 block">
								What We Have Achieved
							</span>
							<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-4">
								Community Training
							</h2>
							<p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
								We trained women and community leaders to strengthen local
								capacity for climate resilience.
							</p>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
							<AchievementCard
								stat="142"
								title="Kitui County"
								description="Women trained on entrepreneurship, household resilience, and climate-informed livelihoods."
							/>
							<AchievementCard
								stat="58"
								title="Isiolo County"
								description="Women trained on renewable energy, clean household energy, and sustainable energy practices."
							/>
							<AchievementCard
								stat="40"
								title="Community Leadership"
								description="Community Captains trained to support community mobilisation, climate awareness, referral pathways, and local resilience efforts."
							/>
						</div>
					</div>
				</section>

				{/* Expanding Access to Clean Energy */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
							<div>
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Expanding Access to Clean Energy
								</span>
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
									200 household solar lighting systems distributed across Kitui
									and Isiolo Counties.
								</h2>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed mb-8">
									Each vulnerable household received a portable solar lighting
									system equipped with:
								</p>
								<ul className="space-y-3 mb-8">
									{[
										"Solar charging panel",
										"Rechargeable battery",
										"Multiple LED lights",
										"Mobile phone charging",
										"Integrated radio",
									].map((item) => (
										<li key={item} className="flex items-center gap-3">
											<CheckCircle2 className="w-5 h-5 text-sauti-teal shrink-0" />
											<span className="text-base md:text-lg text-gray-700 font-medium">
												{item}
											</span>
										</li>
									))}
								</ul>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed">
									These systems provide a clean alternative to kerosene lamps,
									candles, and disposable battery-powered lighting.
								</p>
							</div>
							<div className="relative aspect-[4/3] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-2xl">
								<Image
									src="/events/impact/climate-care/group-distribution.jpeg"
									alt="Women holding their household solar lighting systems after a distribution in Kitui County"
									fill
									className="object-cover"
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Why Solar Lighting Matters */}
				<section className="py-12 md:py-24 bg-sauti-dark text-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24">
							<div>
								<span className="text-sauti-yellow font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Why Solar Lighting Matters
								</span>
								<h2 className="text-2xl md:text-4xl font-black mb-6 leading-tight">
									Access to reliable lighting changes everyday life.
								</h2>
								<p className="text-white/70 text-base md:text-lg leading-relaxed">
									Clean energy also strengthens the conditions under which care
									is provided, making caregiving safer, healthier, and more
									dignified.
								</p>
							</div>
							<ul className="space-y-4">
								{[
									"Prepare meals safely after sunset.",
									"Support children's evening study.",
									"Reduce exposure to smoke from kerosene lamps.",
									"Lower household energy costs.",
									"Charge mobile phones at home.",
									"Improve safety around the household at night.",
									"Reduce reliance on carbon-intensive lighting sources.",
								].map((item) => (
									<li key={item} className="flex items-start gap-4">
										<Lightbulb className="w-6 h-6 text-sauti-yellow shrink-0 mt-0.5" />
										<span className="text-base md:text-lg text-white/90 font-medium">
											{item}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</section>

				{/* Climate, Care and Women's Safety */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="max-w-4xl mx-auto text-center mb-12">
							<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
								Climate, Care and Women&apos;s Safety
							</span>
							<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
								Clean energy is not only a climate solution — it is an
								investment in care, dignity, and community wellbeing.
							</h2>
							<p className="text-base md:text-lg text-gray-600 leading-relaxed">
								Women and girls often spend long hours managing household
								responsibilities while navigating unsafe environments after
								dark. By improving household lighting and access to renewable
								energy, the project contributes to:
							</p>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
							{[
								"Safer movement around homes and compounds.",
								"Better conditions for childcare and caregiving.",
								"Reduced exposure to indoor air pollution.",
								"Increased household resilience during climate-related shocks.",
								"Stronger community awareness of gender-based violence prevention.",
							].map((item) => (
								<div
									key={item}
									className="flex items-start gap-3 p-5 rounded-2xl bg-gray-50 border-2 border-gray-100"
								>
									<ShieldCheck className="w-6 h-6 text-sauti-teal shrink-0 mt-0.5" />
									<span className="text-sm md:text-base text-gray-700 font-medium">
										{item}
									</span>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Community-Led Implementation */}
				<section className="py-12 md:py-24 bg-gray-50">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
							<div>
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Community-Led Implementation
								</span>
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
									Community ownership has been central throughout
									implementation.
								</h2>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed mb-6">
									Working alongside Community Captains, local administration,
									Northern Vision, and community volunteers, the project adopted
									a participatory approach to:
								</p>
								<ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
									{[
										"Community mobilisation",
										"Beneficiary verification",
										"Household selection",
										"Renewable energy demonstrations",
										"Solar lighting distribution",
										"Community follow-up",
									].map((item) => (
										<li key={item} className="flex items-center gap-3">
											<Handshake className="w-5 h-5 text-sauti-yellow shrink-0" />
											<span className="text-sm md:text-base text-gray-700 font-medium">
												{item}
											</span>
										</li>
									))}
								</ul>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed">
									This collaborative model strengthened transparency,
									accountability, and local ownership of project activities.
								</p>
							</div>
							<div className="relative aspect-[4/3] rounded-[32px] md:rounded-[60px] overflow-hidden shadow-2xl">
								<Image
									src="/events/impact/climate-care/solar-demo.jpeg"
									alt="Renewable energy demonstration during a community distribution session"
									fill
									className="object-cover"
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Project Impact Stats */}
				<section className="py-12 md:py-24 bg-sauti-teal">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<h2 className="text-2xl md:text-4xl font-black text-white text-center mb-12 md:mb-16">
							Project Impact
						</h2>
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 text-center">
							<StatBlock stat="200" label="Households equipped with solar lighting systems" />
							<StatBlock stat="200" label="Women trained across Kitui and Isiolo" />
							<StatBlock stat="40" label="Community Captains strengthening local climate resilience" />
							<StatBlock stat="2" label="ASAL counties reached" />
						</div>
					</div>
				</section>

				{/* Stories from the Field */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="max-w-4xl mx-auto">
							<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block text-center">
								Stories from the Field
							</span>
							<blockquote className="text-xl md:text-3xl font-bold text-sauti-dark leading-relaxed text-center mb-8">
								&ldquo;As evening fell in Tumbuni, children gathered around
								their new solar light to complete their homework while their
								mother prepared dinner under bright, smoke-free
								lighting.&rdquo;
							</blockquote>
							<p className="text-base md:text-lg text-gray-600 leading-relaxed text-center">
								For the family, the solar lighting system represented more than
								electricity. It created a safer home, reduced the cost of buying
								kerosene, improved study conditions for children, and made
								evening caregiving easier. Across Kitui and Isiolo, similar
								stories continue to demonstrate how access to clean energy
								strengthens both climate resilience and everyday care.
							</p>
						</div>
					</div>
				</section>

				{/* Looking Ahead + Partners */}
				<section className="py-12 md:py-24 bg-gray-50">
					<div className="container mx-auto px-4 md:px-12 lg:px-32 max-w-[1400px]">
						<div className="grid lg:grid-cols-2 gap-12 lg:gap-24">
							<div>
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Looking Ahead
								</span>
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6 leading-tight">
									Building evidence for care-centred climate solutions.
								</h2>
								<p className="text-base md:text-lg text-gray-600 leading-relaxed">
									This project marks an important step toward building evidence
									on the relationship between climate resilience, unpaid care
									work, renewable energy, and gender-based violence prevention.
									Sauti Salama will continue working with communities, local
									partners, and researchers to strengthen care-centred climate
									solutions that improve the lives of women, girls, and families
									across Kenya&apos;s ASAL regions.
								</p>
							</div>
							<div>
								<span className="text-sauti-teal font-bold uppercase tracking-widest text-xs md:text-sm mb-4 block">
									Project Partners
								</span>
								<dl className="space-y-5">
									<div>
										<dt className="text-sm font-black uppercase tracking-widest text-gray-400 mb-1">
											Implemented by
										</dt>
										<dd className="text-base md:text-lg font-bold text-sauti-dark">
											Sauti Salama
										</dd>
									</div>
									<div>
										<dt className="text-sm font-black uppercase tracking-widest text-gray-400 mb-1">
											Supported by
										</dt>
										<dd className="text-base md:text-lg font-bold text-sauti-dark">
											Fundación Avina
										</dd>
									</div>
									<div>
										<dt className="text-sm font-black uppercase tracking-widest text-gray-400 mb-1">
											With funding from
										</dt>
										<dd className="text-base md:text-lg font-bold text-sauti-dark">
											Climate and Care Initiative
										</dd>
									</div>
									<div>
										<dt className="text-sm font-black uppercase tracking-widest text-gray-400 mb-1">
											Implementation Partners
										</dt>
										<dd className="text-base md:text-lg font-bold text-sauti-dark">
											Northern Vision, Savanna Kitui, Women Empowerment Fund,
											KCB Mwingi, Government of Kenya
										</dd>
									</div>
								</dl>
							</div>
						</div>
					</div>
				</section>

				{/* Get Involved CTA */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container mx-auto px-4 md:px-12 max-w-4xl text-center">
						<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-6">
							Get Involved
						</h2>
						<p className="text-base md:text-lg text-gray-600 leading-relaxed mb-8">
							We welcome collaboration with donors, researchers, community
							organisations, private sector partners, and policymakers
							interested in advancing care-centred climate action.
						</p>
						<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
							<Link href="mailto:info@sautisalama.org">
								<Button className="rounded-full bg-sauti-teal text-white font-black px-8 h-12 hover:bg-sauti-teal/90 shadow-lg flex items-center gap-2">
									<Mail className="w-5 h-5" /> info@sautisalama.org
								</Button>
							</Link>
							<Link href="/volunteer">
								<Button
									variant="outline"
									className="rounded-full border-2 border-sauti-dark text-sauti-dark font-black px-8 h-12 hover:bg-sauti-dark hover:text-white transition-all"
								>
									Partner With Us
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

function PillarCard({
	icon,
	title,
	description,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<div className="p-6 md:p-8 rounded-[32px] md:rounded-[40px] bg-white border-2 border-gray-50 hover:border-sauti-yellow/20 hover:shadow-2xl transition-all">
			<div className="w-12 h-12 md:w-16 md:h-16 rounded-[16px] md:rounded-2xl bg-gray-50 flex items-center justify-center mb-6">
				{icon}
			</div>
			<h3 className="text-lg md:text-xl font-black text-sauti-dark mb-4 uppercase tracking-tight">
				{title}
			</h3>
			<p className="text-sm md:text-base text-gray-500 font-medium leading-relaxed">
				{description}
			</p>
		</div>
	);
}

function AchievementCard({
	stat,
	title,
	description,
}: {
	stat: string;
	title: string;
	description: string;
}) {
	return (
		<div className="p-8 rounded-[32px] bg-white border-2 border-gray-100 hover:shadow-xl transition-all text-center">
			<div className="text-5xl md:text-6xl font-black text-sauti-teal mb-3">
				{stat}
			</div>
			<h3 className="text-lg md:text-xl font-black text-sauti-dark mb-3 uppercase tracking-tight">
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
			<div className="text-5xl md:text-7xl font-black text-sauti-yellow mb-3">
				{stat}
			</div>
			<div className="text-white/90 font-bold uppercase tracking-wider text-xs md:text-sm max-w-[220px]">
				{label}
			</div>
		</div>
	);
}
