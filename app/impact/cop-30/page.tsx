"use client";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";

export default function Cop30Page() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Nav />
            <main className="flex-1">
                {/* Hero */}
                <section className="relative h-[60vh] md:h-[80vh] flex items-end pb-20 overflow-hidden">
                    <Image
                        src="/events/impact/at cop30.png"
                        alt="Sauti Salama at COP"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-sauti-dark via-sauti-dark/40 to-transparent" />
                    
                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <Link href="/impact">
                            <Button variant="ghost" className="text-white hover:bg-white/10 mb-8 rounded-full">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Impact
                            </Button>
                        </Link>
                        <span className="inline-block px-4 py-1 rounded-full bg-sauti-teal text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-6">
                            Global Advocacy
                        </span>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 max-w-4xl">
                            Gender, Climate Justice and Community Resilience
                        </h1>
                        <p className="text-xl md:text-2xl text-white/90 max-w-2xl font-light">
                            Our full report from COP30: Centering lived realities in global climate governance.
                        </p>
                    </div>
                </section>

                {/* TLDR */}
                <section className="py-12 bg-sauti-light-teal border-b border-sauti-teal/20">
                     <div className="container px-4 max-w-4xl mx-auto">
                        <h2 className="text-sauti-teal font-black uppercase tracking-widest text-sm mb-4">TLDR; Executive Summary</h2>
                        <div className="text-lg md:text-2xl font-bold text-sauti-dark leading-tight">
                            At COP30 in Belém, Sauti Salama demonstrated that climate decisions must be grounded in the lived experiences of African women and girls. We highlighted gaps in the Gender Action Plan, the critical lack of care financing, and the urgent need for direct access to Loss and Damage funds for survivor-led organisations.
                        </div>
                     </div>
                </section>

                {/* Content */}
                <section className="py-20 md:py-32 bg-white">
                    <div className="container px-4 max-w-4xl mx-auto space-y-16">
                        
                        {/* 1. Introduction */}
                        <div className="prose prose-lg text-gray-700 max-w-none">
                            <h2 className="text-3xl font-bold text-sauti-dark">1. Introduction</h2>
                            <p>
                                COP30 took place at a moment of profound urgency for climate governance. Climate impacts are accelerating across the globe, yet the international system continues to respond with fragmented commitments, limited financing, and persistent resistance to rights-based language. For Kenya and the wider African continent, the climate crisis is already reshaping daily life, affecting water access, food security, public health, mobility, safety, and community cohesion.
                            </p>
                            <p>
                                Against this backdrop, Sauti Salama, a youth-led, survivor-centered feminist organisation, entered COP30 with a mandate to ensure that the lived realities of women, adolescent girls, queer communities, and marginalised groups remained visible in global climate conversations. Our participation reflected the interconnected nature of our work: gender justice, care, climate resilience, survivor protection, and community-rooted adaptation.
                            </p>
                            <p>
                                Belém’s Amazonian setting reinforced the stakes. At the heart of ecological richness and histories of extractivism, the venue served as a reminder that climate decisions must be grounded in the lived experiences of those who are most impacted by environmental degradation yet excluded from policy power. This Executive Summary presents the overarching findings of our participation.
                            </p>
                        </div>

                         {/* 2. Overview of Participation */}
                        <div className="bg-gray-50 rounded-[40px] p-10 md:p-14">
                            <h2 className="text-2xl font-bold text-sauti-dark mb-6">2. Overview of Participation</h2>
                            <ul className="space-y-3 mb-6">
                                {[
                                    "Informal Consultations on Gender and Climate Change",
                                    "Gender Action Plan negotiations observed through the Women and Gender Constituency",
                                    "Loss and Damage Fund governance discussions",
                                    "Climate Justice and Reparations dialogues",
                                    "Water Governance and Youth engagements",
                                    "A session on Women’s Leadership and Policy",
                                    "A panel contribution at the C.A.S.E House event",
                                    "A speaking role at the UNFPA session focused exclusively on GBV within climate-affected communities"
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-3 items-start">
                                        <div className="w-1.5 h-1.5 rounded-full bg-sauti-teal mt-2.5" />
                                        <span className="text-lg text-gray-700">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-gray-700 italic">
                                Across these engagements, Sauti Salama consistently emphasized the intersections between climate impacts, gendered inequalities, care burdens, safety risks, and community-rooted resilience strategies.
                            </p>
                        </div>

                         {/* Image Break */}
                        <div className="my-12 relative aspect-video rounded-[32px] overflow-hidden shadow-2xl">
                              <Image 
                                    src="/events/impact/cop 30 panel review.png" 
                                    alt="Sauti Salama Panel" 
                                    fill 
                                    className="object-cover" 
                                />
                        </div>

                        {/* 3. Key Insights */}
                        <div className="prose prose-lg text-gray-700 max-w-none">
                            <h2 className="text-3xl font-bold text-sauti-dark mb-8">3. Key Insights</h2>
                            
                            <h3 className="text-xl font-bold text-sauti-teal">3.1 Gendered Harm and Climate Impacts</h3>
                            <p>
                                Across negotiation rooms and civil society dialogues, a recurring observation emerged: climate change magnifies pre-existing inequalities. In Kenyan communities facing droughts, floods, and displacement, women and girls shoulder expanded care responsibilities, navigate longer and more dangerous routes for essential resources, lose access to health and protection services, and face heightened exposure to gender-based violence. These patterns are not unique to Kenya but reflect a shared Global South experience.
                            </p>

                            <h3 className="text-xl font-bold text-sauti-teal mt-10">3.2 Gaps and Opportunities in the Gender Action Plan</h3>
                            <p>The final Gender Action Plan reflects both meaningful openings and significant political constraints.</p>
                            <p><strong>Notable advances include:</strong> Recognition of care work in UNFCCC monitoring, continuation of protections for women environmental defenders, and intersectional references.</p>
                            <p><strong>Major gaps remain:</strong> Complete removal of SRHR, no acknowledgment of climate-induced GBV, diluted language on gender-responsive finance, and no financing provisions for care systems.</p>

                            <h3 className="text-xl font-bold text-sauti-teal mt-10">3.3 The State of Loss and Damage Finance</h3>
                            <p>
                                Discussions on the Loss and Damage Fund highlighted a fundamental mismatch between commitments and capability. Only a portion of pledged funds is currently available, contributions remain voluntary, and governance structures hosted under the World Bank restrict direct access for frontline communities.
                            </p>

                            <h3 className="text-xl font-bold text-sauti-teal mt-10">3.4 Reparations and Justice Conversations</h3>
                            <p>
                                Outside formal negotiation spaces, dialogues on climate justice and reparations created rare opportunities for honest assessments of historical responsibility. These dialogues underscored the need for justice-driven approaches rather than charity-based interventions.
                            </p>
                         </div>

                         {/* 4. Sauti Salama’s Contributions & Conclusion */}
                          <div className="prose prose-lg text-gray-700 max-w-none">
                            <h2 className="text-3xl font-bold text-sauti-dark">4. Conclusion</h2>
                            <p>
                                COP30 reaffirmed that gender justice is inseparable from climate justice. While global frameworks continue to advance incrementally, the lived realities of frontline communities demand far more decisive, well-resourced, and rights-based action. The presence of organisations like Sauti Salama at COP30 is not supplementary but essential. We return from Belém with strengthened resolve to advance feminist, community-rooted climate resilience.
                            </p>
                        </div>
                    </div>
                </section>
                
                <section className="bg-sauti-dark py-24 text-center">
                    <div className="container px-4 mx-auto">
                        <h2 className="text-3xl text-white font-bold mb-8">Climate Action</h2>
                        <Link href="/programs">
                             <Button className="rounded-full bg-sauti-teal text-white px-10 py-6 text-lg font-bold hover:bg-sauti-teal/90 shadow-xl shadow-sauti-teal/20">
                                View Our Kiwu Initiative <ArrowRight className="ml-2 w-5 h-5"/>
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
