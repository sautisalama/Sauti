import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Instagram, Twitter, Linkedin, Facebook, Music2 } from "lucide-react";

export function Footer() {
	return (
		<footer className="bg-sauti-dark pt-24 pb-12 text-white">
			<div className="container max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-20 border-b border-white/10 pb-20">
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
                            <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all"><Instagram className="h-5 w-5" /></Link>
                            <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all"><Twitter className="h-5 w-5" /></Link>
                            <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all"><Linkedin className="h-5 w-5" /></Link>
                            <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-sauti-yellow hover:text-sauti-dark transition-all"><Music2 className="h-5 w-5" /></Link>
                        </div>
                    </div>

                    {/* Newsletter */}
                    <div className="lg:col-span-1">
                        <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-sauti-yellow">Newsletter</h4>
                        <p className="text-white/70 text-sm mb-6 font-medium">Get the latest impact stories and community actions.</p>
                        <div className="flex flex-col gap-3">
                            <Input 
                                placeholder="Email address" 
                                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10 transition-all h-12"
                            />
                            <Button className="rounded-xl bg-sauti-yellow text-sauti-dark font-black h-12 hover:bg-sauti-yellow/90 shadow-lg">
                                Subscribe Now
                            </Button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="lg:col-span-2 grid grid-cols-2 gap-12 lg:pl-12">
                        <div>
                            <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-white/40">Navigation</h4>
                            <ul className="space-y-4">
                                <li><Link href="/" className="text-base text-white/70 hover:text-white transition-colors">Home</Link></li>
                                <li><Link href="/about" className="text-base text-white/70 hover:text-white transition-colors">Our Story</Link></li>
                                <li><Link href="/programs" className="text-base text-white/70 hover:text-white transition-colors">Programs</Link></li>
                                <li><Link href="/impact" className="text-base text-white/70 hover:text-white transition-colors">Impact</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-sm font-black mb-8 uppercase tracking-widest text-white/40">Support</h4>
                            <ul className="space-y-4">
                                <li><Link href="/faq" className="text-base text-white/70 hover:text-white transition-colors">Help Center</Link></li>
                                <li><Link href="/volunteer" className="text-base text-white/70 hover:text-white transition-colors">Volunteer</Link></li>
                                <li><Link href="/privacy-policy" className="text-base text-white/70 hover:text-white transition-colors">Privacy</Link></li>
                                <li className="text-base font-bold text-white pt-2">Hotline: 1195</li>
                            </ul>
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
			</div>
		</footer>
	);
}
