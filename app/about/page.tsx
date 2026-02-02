"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
    UsersRound, 
    Search, 
    HeartHandshake,
    CheckCircle2,
    ArrowRight,
    Leaf,
    Smartphone,
    Scale,
    Shield
} from "lucide-react";
import { CircledText } from "@/components/ui/CircledText";
import { 
    Dialog, 
    DialogContent, 
    DialogTrigger 
} from "@/components/ui/dialog";
import ReportAbuseForm from "@/components/ReportAbuseForm";

export default function AboutPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main className="flex-1">
                {/* 1. HERO SECTION */}
				<section className="py-12 md:py-24 bg-white">
					<div className="container px-4 max-w-7xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                            <div>
                                <div className="inline-block rounded-full px-4 py-1 text-xs md:text-sm font-bold bg-sauti-yellow/10 text-sauti-yellow mb-6 uppercase tracking-wider">
                                    About Sauti Salama
                                </div>
                                <motion.h1 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-sauti-dark leading-tight mb-8"
                                >
                                   Reducing barriers to <CircledText circleColor="#F4B400">safety, care,</CircledText> and justice.
                                </motion.h1>
                                <p className="text-lg md:text-xl text-gray-600 leading-relaxed font-light mb-8">
                                    Sauti Salama works to reduce barriers to safety, care, and justice for women and girls. We are a youth- and survivor-led feminist organisation based in Kenya.
                                </p>
                                <p className="text-lg md:text-xl text-gray-600 leading-relaxed font-light mb-10">
                                    We work at the intersection of community care, legal access, healing, and feminist technology to respond to gender-based violence and its root causes.
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="rounded-full bg-sauti-red text-white px-8 py-6 text-lg font-bold shadow-xl hover:bg-sauti-red/90 transition-all">
                                                Get Support
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[24px]">
                                            <ReportAbuseForm />
                                        </DialogContent>
                                    </Dialog>
                                    <Link href="#our-work">
                                        <Button variant="outline" className="rounded-full border-2 border-sauti-dark text-sauti-dark px-8 py-6 text-lg font-bold hover:bg-sauti-dark hover:text-white transition-all">
                                            Explore our work
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="relative rounded-[40px] overflow-hidden shadow-2xl aspect-[4/5] bg-gray-100">
                                     <Image src="/landing/team.png" alt="Sauti Salama Team" fill className="object-cover" />
                                </div>
                                {/* Why We Exist Float */}
                                <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-[32px] shadow-xl max-w-md hidden md:block">
                                    <h3 className="text-xl font-bold text-sauti-dark mb-3">Why we exist</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        Gender-based violence is shaped by silence, distance from services, fear, and stigma. We exist to reduce these barriers and ensure support is reachable.
                                    </p>
                                </div>
                            </div>
                        </div>
					</div>
				</section>

                {/* 2. WHO WE ARE & VALUES */}
                <section className="py-20 md:py-32 bg-gray-50">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="mb-20">
                            <h2 className="text-3xl md:text-5xl font-bold text-sauti-dark mb-8 font-serif">Who we are</h2>
                             <div className="grid md:grid-cols-2 gap-12 text-lg text-gray-700 leading-relaxed">
                                 <div>
                                     <p className="mb-6">
                                         Sauti Salama is a Kenyan feminist organisation founded in response to gaps in access to care, safety, and justice for women and girls. Our work emerged from community organising and survivor support, where it became clear that many people are expected to navigate harm alone.
                                     </p>
                                 </div>
                                 <div>
                                     <p>
                                         We are led by young women and youth, and our work is shaped by survivor-informed practice, accountability, and community trust.
                                     </p>
                                 </div>
                             </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-16 items-start">
                            <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-lg">
                                <h3 className="text-2xl md:text-4xl font-bold text-sauti-dark mb-10 font-serif">Our Values</h3>
                                <ul className="space-y-8">
                                    <ValueItem 
                                        title="Care as a collective responsibility" 
                                        desc="Care is central to justice and community resilience."
                                    />
                                    <ValueItem 
                                        title="Consent within systems" 
                                        desc="Safety requires consent to be built into institutions, tools, and processes, not placed solely on individuals."
                                    />
                                    <ValueItem 
                                        title="Accountability over visibility" 
                                        desc="We prioritise responsible practice, safeguarding, and learning over public recognition."
                                    />
                                    <ValueItem 
                                        title="Community before tools" 
                                        desc="Technology supports community-led response; it does not replace it."
                                    />
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-2xl md:text-4xl font-bold text-sauti-dark mb-8 font-serif">Our Approach</h3>
                                <div className="bg-sauti-teal/10 p-10 rounded-[40px] mb-8">
                                    <p className="text-lg md:text-xl text-sauti-dark leading-relaxed font-medium">
                                        We work across community organising, digital access, and institutional engagement to strengthen survivor-centred response systems.
                                    </p>
                                </div>
                                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                                    We recognise that existing systems are often fragmented or inaccessible, and we work to bridge these gaps while advocating for structural change.
                                </p>
                                <p className="text-lg text-gray-700 leading-relaxed font-bold">
                                    Our approach is feminist, practical, and grounded in lived realities.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                 {/* 3. OUR WORK */}
                 <section id="our-work" className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <span className="text-sauti-teal font-bold uppercase tracking-widest text-sm mb-4 block">How we do it</span>
                            <h2 className="text-4xl md:text-6xl font-bold text-sauti-dark font-serif">Our Work</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                            <WorkCard 
                                icon={<HeartHandshake className="w-8 h-8"/>}
                                title="Access to Care and Support"
                                desc="We support women and girls to access psychosocial care, justice information, and referral pathways. Our work prioritises confidentiality, choice, and dignity. We focus on reducing harm and increasing access rather than controlling outcomes."
                            />
                            <WorkCard 
                                icon={<UsersRound className="w-8 h-8"/>}
                                title="Community Organising"
                                desc="Violence thrives in isolation. We work with youth, caregivers, and community leaders to strengthen local response networks, encourage shared responsibility, and support prevention rooted in care and accountability."
                            />
                            <WorkCard 
                                icon={<Scale className="w-8 h-8"/>}
                                title="Legal Access and Advocacy"
                                desc="Access to justice is shaped by information, support, and trust. We work to improve legal literacy, navigation, and survivor accompaniment, and we engage in advocacy informed by community experience."
                            />
                            <WorkCard 
                                icon={<Smartphone className="w-8 h-8"/>}
                                title="Feminist Technology"
                                desc="We develop and maintain digital tools that support access to information, reporting options, and care pathways. Our technology work centres consent, data protection, and survivor safety, and is guided by ongoing community feedback."
                            />
                        </div>
                    </div>
                 </section>

                 {/* 4. THE SAUTI SALAMA APP (Formerly Digital Platform) */}
                 <section className="py-20 md:py-32 bg-sauti-dark text-white overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
                         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sauti-teal rounded-full blur-[120px]" />
                         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-sauti-yellow rounded-full blur-[120px]" />
                    </div>
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="order-2 lg:order-1">
                                <span className="text-sauti-yellow font-bold uppercase tracking-widest text-sm mb-4 block">Our Main Tool</span>
                                <h2 className="text-3xl md:text-5xl font-bold mb-6 font-serif">The Sauti Salama App</h2>
                                <p className="text-lg md:text-xl text-white/80 leading-relaxed mb-8 font-light">
                                    The Sauti Salama platform is designed to reduce barriers to support. It serves as our primary digital infrastructure, providing anonymous reporting, resource mapping, and secure communication channels.
                                </p>
                                <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-10 backdrop-blur-sm">
                                    <ul className="space-y-4">
                                        {[
                                            "Access to rights and justice information", 
                                            "Safe pathways to psychosocial support",
                                            "Reporting options grounded in consent",
                                            "Clear guidance without pressure"
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start gap-4">
                                                <div className="w-6 h-6 rounded-full bg-sauti-teal flex items-center justify-center shrink-0 mt-1">
                                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-lg font-medium text-white/90">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Link href="/signup">
                                    <Button className="rounded-full bg-sauti-yellow text-sauti-dark px-10 py-7 text-xl font-bold hover:bg-sauti-yellow/90 transition-all shadow-xl hover:shadow-sauti-yellow/20">
                                        Explore Platform
                                        <ArrowRight className="ml-2 w-6 h-6"/>
                                    </Button>
                                </Link>
                            </div>
                            
                            {/* Visuals: Desktop & Mobile Mockups */}
                            <div className="order-1 lg:order-2 relative h-[500px] lg:h-[600px] flex items-center justify-center">
                                {/* Desktop Mockup */}
                                <div className="absolute top-10 left-0 lg:-left-10 w-[90%] md:w-[80%] aspect-video bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden z-10 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                                     <div className="w-full h-8 bg-gray-900 flex items-center px-4 gap-2">
                                         <div className="w-3 h-3 rounded-full bg-red-500"/>
                                         <div className="w-3 h-3 rounded-full bg-yellow-500"/>
                                         <div className="w-3 h-3 rounded-full bg-green-500"/>
                                     </div>
                                     <div className="relative w-full h-full bg-white">
                                         <Image src="/landing.png" alt="Desktop Dashboard" fill className="object-cover object-top" />
                                     </div>
                                </div>

                                {/* Mobile Mockup */}
                                <div className="absolute bottom-0 right-4 lg:right-0 w-[180px] md:w-[240px] aspect-[9/19] bg-gray-900 rounded-[3rem] border-8 border-gray-900 shadow-2xl overflow-hidden z-20 transform translate-y-10 hover:translate-y-6 transition-transform duration-500">
                                     <div className="relative w-full h-full bg-white">
                                         <Image src="/splash.png" alt="Mobile App" fill className="object-cover" />
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                 </section>

                 {/* 5. CLIMATE, CARE, AND KIWU (Moved down) */}
                 <section className="py-20 md:py-32 bg-sauti-light-teal overflow-hidden relative">
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <span className="inline-block px-4 py-1 rounded-full bg-sauti-teal text-white text-xs font-bold uppercase tracking-wider mb-6">Climate Justice</span>
                                <h2 className="text-3xl md:text-5xl font-bold text-sauti-dark mb-8 font-serif">Climate, Care, and Kiwu</h2>
                                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                                    Climate shocks intensify existing inequalities and increase risks of violence. Water scarcity, energy poverty, displacement, and unsafe movement place disproportionate burdens on women and girls.
                                </p>
                                <p className="text-lg text-gray-700 leading-relaxed mb-8">
                                    <strong className="text-sauti-teal">Kiwu</strong> is Sauti Salama’s climate and care initiative that responds to these realities through practical, low-cost infrastructure that supports safety, dignity, and resilience in climate-vulnerable communities.
                                </p>
                                <p className="text-xl font-serif text-sauti-dark italic mb-10">
                                    For Sauti Salama, climate resilience is inseparable from care and protection.
                                </p>
                                <Link href="/programs">
                                    <Button className="rounded-full bg-sauti-teal text-white px-8 py-6 text-lg font-bold shadow-xl hover:bg-sauti-teal/90 transition-all">
                                        View Programs
                                        <ArrowRight className="ml-2 w-5 h-5"/>
                                    </Button>
                                </Link>
                            </div>
                            <div className="relative">
                                <div className="relative z-10 rounded-[40px] overflow-hidden shadow-2xl aspect-square rotate-3 hover:rotate-0 transition-all duration-500">
                                     <Image src="/events/impact/Community -Letu.png" alt="Kiwu Initiative" fill className="object-cover" />
                                </div>
                                <div className="absolute top-10 -right-10 w-full h-full bg-white/30 rounded-[40px] -rotate-6 z-0" />
                            </div>
                        </div>
                    </div>
                 </section>

                 {/* 6. OUR TEAM */}
                 <section className="py-20 md:py-32 bg-white">
                     <div className="container px-4 max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl md:text-6xl font-bold text-sauti-dark font-serif mb-6">Our Team</h2>
                            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                                Sauti Salama is led by young women and youth and supported by a multidisciplinary team.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
                            {[
                                { name: "Malkia Mutwoki", role: "Executive Director", image: "/team/malkia mutwoki - executive director.png" },
                                { name: "Liza Wanja", role: "Programs Coordinator", image: "/team/liza wanja - programs cordinator.jpeg" },
                                { name: "Rosemary Kanyi", role: "Partnerships Lead", image: "/team/rosemary kanyi - patnerships lead.png" },
                                { name: "Elvine", role: "Communications Lead", image: "/team/elvine-communications lead.png" },
                                { name: "Milligan Nyabuto", role: "Legal", image: "/team/milligan Nyabuto - legal.jpeg" },
                                { name: "Mwende", role: "Administrator", image: "/team/mwende - administrator.png" },
                                { name: "Oliver Wainaina", role: "Tech Lead", image: "/team/oliver wainaina - tech lead.jpg" }
                            ].map((member, i) => (
                                <div key={i} className="group flex flex-col items-center text-center">
                                    <div className="w-48 h-48 rounded-full overflow-hidden mb-6 border-4 border-gray-50 shadow-lg relative group-hover:scale-105 transition-transform duration-500">
                                         <Image src={member.image} alt={member.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-sauti-dark mb-1">{member.name}</h3>
                                    <p className="text-sauti-teal font-medium text-sm mb-4 uppercase tracking-wider">{member.role}</p>
                                </div>
                            ))}
                        </div>
                     </div>
                 </section>

                 {/* 7. PARTNERS, IMPACT, GOVERNANCE */}
                 <section className="py-20 md:py-32 bg-gray-50 border-t border-gray-200">
                    <div className="container px-4 max-w-5xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-16">
                            <div>
                                <h3 className="text-2xl font-bold text-sauti-dark mb-6">Partners and Networks</h3>
                                <p className="text-gray-600 leading-relaxed mb-8">
                                    We collaborate with community-based organisations, legal actors, health providers, youth networks, and regional and global coalitions. Our partnerships are built on shared values, clarity of roles, and mutual accountability.
                                </p>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-sauti-dark mb-6">Impact and Learning</h3>
                                <p className="text-gray-600 leading-relaxed mb-8">
                                    We believe in learning as part of accountability. Alongside progress, we reflect on challenges, gaps, and areas for improvement. This allows us to strengthen our work and remain responsive to the communities we serve.
                                </p>
                            </div>
                        </div>
                        <div className="mt-16 pt-16 border-t border-gray-200 text-center">
                             <h3 className="text-xl font-bold text-sauti-dark mb-4">Our Governance</h3>
                             <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto">
                                Sauti Salama operates with clear governance structures, safeguarding policies, and accountability mechanisms to ensure responsible leadership and ethical practice.
                            </p>
                        </div>
                    </div>
                 </section>

                 <section className="bg-sauti-light-teal py-12 md:py-24">
                      <div className="container px-4 max-w-5xl mx-auto text-center">
                         <h2 className="text-2xl md:text-5xl font-bold text-sauti-dark mb-8 md:mb-12 relative inline-block px-6 font-serif">
                             Join the Movement.
                         </h2>
                         <p className="text-lg md:text-xl text-gray-600 mb-10 md:mb-16 max-w-3xl mx-auto leading-relaxed">
                             Support our mission to building a safer world for women and girls.
                         </p>
                         <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
                             <Link href="/volunteer">
                                 <Button className="rounded-full bg-sauti-dark text-white px-8 md:px-10 py-6 md:py-8 text-lg font-bold shadow-xl hover:bg-sauti-dark/90 transition-all">
                                     Volunteer With Us
                                 </Button>
                             </Link>
                             <Link href="/volunteer">
                                 <Button variant="outline" className="rounded-full border-2 border-sauti-dark text-sauti-dark px-8 md:px-10 py-6 md:py-8 text-lg font-bold hover:bg-sauti-dark hover:text-white transition-all">
                                     Contact Support
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

function ValueItem({ title, desc }: { title: string, desc: string }) {
    return (
        <li className="flex gap-4">
            <div className="w-2 h-2 rounded-full bg-sauti-red mt-2.5 shrink-0" />
            <div>
                <h4 className="text-lg font-bold text-sauti-dark mb-1">{title}</h4>
                <p className="text-gray-600 leading-relaxed">{desc}</p>
            </div>
        </li>
    );
}

function WorkCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="bg-gray-50 p-8 rounded-[32px] hover:bg-sauti-light-teal/20 transition-colors duration-300">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-sauti-teal mb-6">
                {icon}
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-sauti-dark mb-4">{title}</h3>
            <p className="text-gray-600 leading-relaxed font-medium">
                {desc}
            </p>
        </div>
    );
}


