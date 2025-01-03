"use client";

import { Nav } from "./Nav";
import Image from "next/image";
import { AnimatedButton } from "./acerternity/AnimatedButton";
import React, { useState, useEffect } from "react";
import { Banner } from "./Banner";
import AboutCard from "./AboutCard";
import {
	ChartColumnBig,
	FilePenLine,
	Headset,
	HeartHandshake,
	LayoutGrid,
	MoveUpRight,
	Search,
	UsersRound,
} from "lucide-react";
import { AccordionFAQs } from "./AccordionFAQs";
import { Button } from "./ui/button";
import { InfiniteMovingCardsDemo } from "./acerternity/InfiniteMovingCardsDemo";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Footer } from "./Footer";
import Forecast from "./forecast";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import ReportAbuseForm from "./ReportAbuseForm";
import { createClient } from "@/utils/supabase/client";

export function LandingPage() {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const supabase = createClient();

	useEffect(() => {
		const checkAuth = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setIsAuthenticated(!!session);
		};

		checkAuth();

		// Set up auth state change listener
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setIsAuthenticated(!!session);
		});

		return () => subscription.unsubscribe();
	}, []);

	return (
		<div className="flex min-h-screen w-full flex-col">
			{/* <Banner /> */}
			<Nav />
			<main className="min-h-[200vh]">
				<div className="bg-landing">
					<div className="container">
						<div className="flex flex-col md:flex-row items-center justify-evenly md:justify-between min-h-[80vh]">
							<div className="flex flex-col gap-8 max-w-full md:max-w-[40%]">
								<h1 className="text-2xl md:text-3xl font-extrabold">
									Breaking the Silence , <br />
									Building a Brighter Future
								</h1>
								<p className="text-sm md:text-base">
									44% of Kenyan women have experienced physical or sexual violence from a
									partner. This is millions of Women living in fear ,suffering immense
									emotional and physical harm, and facing significant barriers to justice
									and healing.
								</p>
								<div className="flex flex-col sm:flex-row gap-4">
									<Dialog>
										<DialogTrigger asChild>
											<div>
												<AnimatedButton text="Report Abuse" icon="📢" variant="default" />
											</div>
										</DialogTrigger>
										<DialogContent className="sm:max-w-4xl">
											<DialogHeader>
												<DialogTitle>Report Abuse</DialogTitle>
												<DialogDescription>
													Please fill out this form to report an incident. All information
													will be kept confidential.
												</DialogDescription>
											</DialogHeader>
											<ReportAbuseForm />
										</DialogContent>
									</Dialog>
									<Link
										href={isAuthenticated ? "/dashboard" : "/signin"}
										className="min-w-full sm:min-w-[60%]"
									>
										<Button
											variant="outline"
											className="w-full flex items-center justify-center gap-2"
										>
											{isAuthenticated ? "Dashboard" : "Sign In"}
											<MoveUpRight className="h-4 w-4" />
										</Button>
									</Link>
								</div>
							</div>
							<div className="mt-0 md:mt-8 md:max-w-[70%]">
								{/* Large Image */}
								<Image
									src="/landing.png"
									alt="landing Image"
									width={600}
									height={450}
									className="hidden md:block"
								/>
								{/* Small Image */}
								<Image
									src="/small-landing.png"
									alt="small landing Image"
									width={300}
									height={225}
									className="md:hidden"
								/>
							</div>
						</div>
					</div>
				</div>
				<div className="container mt-20">
					<div className="flex flex-col items-center justify-between">
						<h1 className="text-2xl md:text-3xl font-extrabold mb-10">
							The Power of Sauti Salama
						</h1>
						<div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 max-w-full md:max-w-[70%] m-auto">
							<AboutCard
								icon={<ChartColumnBig className="mr-2 h-6 w-6" />}
								title="Access to Professional Help"
								text="Get support from legal experts , therapist, Psychologist, counsellors and psychiatrist on our patform"
								className=" w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
							/>
							<AboutCard
								icon={<UsersRound className="mr-2 h-6 w-6" />}
								title="Enjoy the power of Community"
								text="Healing comes from listening to other people with similar stories and you shring yours"
								className=" w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
							/>
							<AboutCard
								icon={<FilePenLine className="mr-2 h-6 w-6" />}
								title="Reporting Abuse"
								text="Report an abuse incident and we'll reach out and offer assistance needed."
								className=" w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
							/>
							<AboutCard
								icon={<LayoutGrid className="mr-2 h-6 w-6" />}
								title="Get Informed"
								text="With the variety of information resources , read articles with useful info self care and how to guides."
								className="hidden sm:block w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
							/>
							<AboutCard
								icon={<HeartHandshake className="mr-2 h-6 w-6" />}
								title="Access Comprehensive Care and Support"
								text="Learn how to rebuild your life after abuse with the wealth of our platform resources"
								className="hidden sm:block w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
							/>
							<AboutCard
								icon={<Headset className="mr-2 h-6 w-6" />}
								title="Survivor Stories"
								text="Empowering you with delightful stories of survivors that rebuilt their life you can too"
								className="hidden sm:block w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1rem)]"
							/>
						</div>
					</div>
				</div>
				<div className="bg-landing mt-20 py-10">
					<div className="container">
						<div className="flex flex-col gap-8 max-w-full md:max-w-[50%] m-auto">
							<h1 className="text-2xl md:text-3xl font-extrabold text-sauti-orange">
								Sauti Salama means “Safe Voice” in <br />
								Swahili.
							</h1>
							<p className="text-sm md:text-base">
								Abuse may dim the light we once bore but at sauti salama your voice is
								heard and we’ll help you walk the journey of healing as a survivor.{" "}
								<br />
								<span className="text-sauti-blue font-bold">
									WE HEAR YOU and WE FEEL YOUR PAIN.
								</span>
							</p>
						</div>
					</div>
				</div>
				<div className="container mt-20">
					<div className="flex flex-col items-center justify-between w-full md:w-[50%] m-auto">
						<h1 className="text-2xl md:text-3xl font-extrabold text-sauti-orange mb-10">
							Frequently Asked Questions
						</h1>
						<div className="relative ml-auto flex-1 md:grow-0 lg:w-[100%] mb-10">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Search Through Our Frequently Asked Questions..."
								className="w-full rounded-full bg-background pl-8 md:w-[200px] lg:w-[536px]"
							/>
						</div>
						<AccordionFAQs />
					</div>
				</div>
				<div className="bg-sauti-black mt-20 py-10">
					<div className="container">
						<div className="flex flex-col gap-8 max-w-full md:max-w-[70%] m-auto">
							<h1 className="text-xl md:text-2xl font-extrabold text-landing">
								Sauti Salama offers a comprehensive Support System which includes
								Information resources, professional resouces and a community. Ready to
								find your voice? Join the Sauti Salama Community.
							</h1>
							<Link href="https://app.sautisalama.org/signin">
								<Button
									variant="default"
									className="bg-landing max-w-full md:max-w-[20%] text-sauti-black hover:text-landing"
								>
									<div className="flex items-center justify-between gap-2">
										Get Started <MoveUpRight className="h-4 w-4" />
									</div>
								</Button>
							</Link>
						</div>
					</div>
				</div>
				<div className="bg-sauti-black py-10">
					<div className="flex flex-col gap-8">
						<div className="min-w-full md:min-w-[20%] px-8 sm:m-auto">
							<h1 className="text-2xl md:text-3xl font-extrabold text-sauti-orange mb-10">
								Testimonials
							</h1>
						</div>
						<InfiniteMovingCardsDemo />
					</div>
				</div>
				<div className="bg-sauti-footer py-20">
					<Footer />
				</div>
				<Forecast />
			</main>
		</div>
	);
}
