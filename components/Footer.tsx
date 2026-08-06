import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Instagram, Twitter, Linkedin, Facebook, Music2, MapPin, Phone, Mail, BadgeCheck } from "lucide-react";
import { ORGANIZATION } from "@/lib/organization";

export function Footer() {
	return (
		<footer className="bg-sauti-dark pt-24 pb-12 text-white">
			<div className="container max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-10 mb-20 border-b border-white/10 pb-20">
                    {/* Brand & Mission */}
                    <div className="lg:col-span-1">
                        <div className="mb-8">
                            <Image 
                                src="/logo.webp" 
                                alt="Sauti Salama Logo" 
                                width={180} 
                                height={60} 
                                className="h-14 w-auto brightness-0 invert" 
                            />
                        </div>
                        <p className="text-white/70 text-lg leading-relaxed mb-10 font-medium">
                            A survivor-led initiative providing safety, care, and justice for all survivors of GBV in Kenya.
                        </p>
                        <div className="flex gap-4">
                            <Link href="https://www.instagram.com/sautisalama" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all" aria-label="Visit our Instagram"><Instagram className="h-5 w-5" /></Link>
                            <Link href="https://x.com/sautisalama" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all" aria-label="Visit our X (Twitter) profile"><Twitter className="h-5 w-5" /></Link>
                            <Link href="https://www.linkedin.com/company/sauti-salama/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all" aria-label="Visit our LinkedIn page"><Linkedin className="h-5 w-5" /></Link>
                        </div>
                    </div>

                    {/* Contact & Physical Location */}
                    <div className="lg:col-span-1">
                        <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-sauti-yellow">Visit Us</h4>
                        <address
                            className="not-italic space-y-5 text-white/70 text-sm leading-relaxed font-medium"
                            itemScope
                            itemType="https://schema.org/NGO"
                        >
                            <meta itemProp="name" content={ORGANIZATION.legalName} />
                            <meta itemProp="url" content={ORGANIZATION.url} />
                            <div
                                className="flex gap-3"
                                itemProp="address"
                                itemScope
                                itemType="https://schema.org/PostalAddress"
                            >
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-sauti-yellow" aria-hidden="true" />
                                <div>
                                    <span itemProp="streetAddress" className="block text-white">
                                        {ORGANIZATION.address.building}, {ORGANIZATION.address.street}
                                    </span>
                                    <span className="block">
                                        {ORGANIZATION.address.locality}, {ORGANIZATION.address.district}
                                    </span>
                                    <span className="block">
                                        <span itemProp="addressLocality">{ORGANIZATION.address.city}</span>
                                        {", "}
                                        <span itemProp="addressRegion">{ORGANIZATION.address.region}</span>
                                        {", "}
                                        <span itemProp="addressCountry">{ORGANIZATION.address.country}</span>
                                    </span>
                                    <span className="block mt-2 text-white/50">
                                        {ORGANIZATION.address.poBox}
                                    </span>
                                    <meta itemProp="postalCode" content={ORGANIZATION.address.postalCode} />
                                    <meta itemProp="postOfficeBoxNumber" content="8786" />
                                </div>
                            </div>
                            <div className="flex gap-3 items-center">
                                <Phone className="h-4 w-4 shrink-0 text-sauti-yellow" aria-hidden="true" />
                                <a
                                    href={`tel:${ORGANIZATION.telephone}`}
                                    itemProp="telephone"
                                    className="hover:text-white transition-colors"
                                >
                                    {ORGANIZATION.telephoneDisplay}
                                </a>
                            </div>
                            <div className="flex gap-3 items-center">
                                <Mail className="h-4 w-4 shrink-0 text-sauti-yellow" aria-hidden="true" />
                                <a
                                    href={`mailto:${ORGANIZATION.email}`}
                                    itemProp="email"
                                    className="hover:text-white transition-colors break-all"
                                >
                                    {ORGANIZATION.email}
                                </a>
                            </div>
                            <div className="flex gap-3 items-start pt-2 border-t border-white/10">
                                <BadgeCheck className="h-4 w-4 mt-3 shrink-0 text-sauti-yellow" aria-hidden="true" />
                                <div className="pt-2">
                                    <span className="block text-[11px] uppercase tracking-widest text-white/40 font-black">
                                        Charity ID
                                    </span>
                                    <span className="text-white font-bold tracking-wide">
                                        {ORGANIZATION.charityId}
                                    </span>
                                </div>
                            </div>
                        </address>
                    </div>

                    {/* Navigation */}
                    <div>
                        <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-white/40">Navigation</h4>
                        <ul className="space-y-4">
                            <li><Link href="/" className="text-base text-white/70 hover:text-white transition-colors">Home</Link></li>
                            <li><Link href="/about" className="text-base text-white/70 hover:text-white transition-colors">Our Story</Link></li>
                            <li><Link href="/programs" className="text-base text-white/70 hover:text-white transition-colors">Programs</Link></li>
                            <li><Link href="/impact" className="text-base text-white/70 hover:text-white transition-colors">Impact</Link></li>
                            <li><Link href="/publications" className="text-base text-white/70 hover:text-white transition-colors">Publications</Link></li>
                            <li><Link href="/contact" className="text-base text-white/70 hover:text-white transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-white/40">Support</h4>
                        <ul className="space-y-4">
                            <li><Link href="/faq" className="text-base text-white/70 hover:text-white transition-colors">Help Center</Link></li>
                            <li><Link href="/volunteer" className="text-base text-white/70 hover:text-white transition-colors">Volunteer</Link></li>
                            <li><Link href="/privacy-policy" className="text-base text-white/70 hover:text-white transition-colors">Privacy</Link></li>
                            <li className="text-base font-bold text-white pt-2">
                                National GBV Hotline: <a href={`tel:${ORGANIZATION.helpline}`} className="text-sauti-yellow hover:underline">{ORGANIZATION.helpline}</a>
                            </li>
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div className="lg:col-span-1">
                        <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-sauti-yellow">Newsletter</h4>
                        <p className="text-white/70 text-sm mb-6 font-medium">Get the latest impact stories and community actions.</p>
                        <div className="flex flex-col gap-3">
                            <Input
                                placeholder="Email address"
                                aria-label="Newsletter email address"
                                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10 transition-all h-12"
                            />
                            <Button className="rounded-xl bg-sauti-yellow text-sauti-dark font-black h-12 hover:bg-sauti-yellow/90 shadow-lg">
                                Subscribe Now
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-bold uppercase tracking-widest text-white/40">
                    <p>© 2026 Sauti Salama Safe Haven. All rights reserved.</p>
                    <div className="flex gap-8">
                        <Link href="/about" className="hover:text-white transition-colors">Our Story</Link>
                        <Link href="/volunteer" className="hover:text-white transition-colors">Volunteer</Link>
                        <Link href="/impact" className="hover:text-white transition-colors">Impact</Link>
                    </div>
                </div>
                <p className="mt-6 text-center md:text-left text-xs text-white/50 font-medium normal-case tracking-normal leading-relaxed">
                    {ORGANIZATION.legalName} is a not-for-profit organisation registered in Kenya as a
                    Company Limited by Guarantee. Charity ID / Registration number{" "}
                    <span className="text-white/80 font-bold">{ORGANIZATION.charityId}</span>. Registered
                    office: {ORGANIZATION.address.building}, {ORGANIZATION.address.street},{" "}
                    {ORGANIZATION.address.locality}, {ORGANIZATION.address.district},{" "}
                    {ORGANIZATION.address.city}, {ORGANIZATION.address.country} ·{" "}
                    {ORGANIZATION.address.poBox} · Tel {ORGANIZATION.telephoneDisplay} ·{" "}
                    {ORGANIZATION.email}
                </p>
			</div>
		</footer>
	);
}
