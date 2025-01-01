"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

type BlogPost = {
	title: string;
	date: string;
	excerpt: string;
	category: string;
	imageUrl: string;
};

const blogPosts: BlogPost[] = [
	{
		title: "ED Certified WANGU KANJA FOUNDATION (K) REGISTERED TRUSTEES",
		date: "November 20, 2024",
		excerpt:
			"We are pleased to inform you that we have completed the ED certification process. This certification recognizes our commitment to transparency and excellence in our mission.",
		category: "News",
		imageUrl: "/blog/certification.png",
	},
	{
		title: "SV Casestudy: Mobile App Documentation",
		date: "February 4, 2022",
		excerpt:
			"A new mobile application is being used in Kenya to document sexual offenses, and it holds promise for securing survivor justice through better evidence collection and management.",
		category: "Research",
		imageUrl: "/blog/mobile-app.png",
	},
	{
		title: "In Kenya, Abuse Survivors Find a New Life in Peanut Butter",
		date: "July 24, 2018",
		excerpt:
			"With no way of supporting their children, many women are trapped in abusive relationships they can't afford to leave. But a new initiative is changing lives through economic empowerment.",
		category: "Women Empowerment",
		imageUrl: "/blog/empowerment.png",
	},
	{
		title: "Where rape survivors fight for justice amid stigma, trauma",
		date: "May 27, 2018",
		excerpt:
			"The #metoo campaign was covered extensively by the media internationally, with reputable titles such as TIME magazine honouring the 'Silence Breakers' who spoke out against sexual harassment.",
		category: "Justice",
		imageUrl: "/blog/justice.png",
	},
];

const categories = [
	"All",
	"News",
	"Women Empowerment",
	"Research",
	"Justice",
	"My Story",
];

export default function BlogPage() {
	const [selectedCategory, setSelectedCategory] = useState("All");

	const filteredPosts =
		selectedCategory === "All"
			? blogPosts
			: blogPosts.filter((post) => post.category === selectedCategory);

	return (
		<div className="container mx-auto py-8 px-4">
			{/* Header */}
			<div className="mb-12 text-center">
				<h1 className="text-4xl font-bold text-[#1A3434] mb-4">Our Resources</h1>
				<p className="text-gray-600 max-w-2xl mx-auto">
					Stay informed about our latest news, success stories, and initiatives in
					supporting survivors.
				</p>
			</div>

			{/* Categories */}
			<div className="mb-8">
				<div className="flex flex-wrap gap-2 justify-center">
					{categories.map((category) => (
						<Button
							key={category}
							variant={selectedCategory === category ? "default" : "outline"}
							onClick={() => setSelectedCategory(category)}
							className={`
                                ${
																																	selectedCategory === category
																																		? "bg-teal-600 hover:bg-teal-700"
																																		: "text-teal-600 border-teal-600 hover:bg-teal-50"
																																}
                            `}
						>
							{category}
						</Button>
					))}
				</div>
			</div>

			{/* Blog Posts Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{filteredPosts.map((post, index) => (
					<Card
						key={index}
						className="overflow-hidden hover:shadow-lg transition-shadow"
					>
						<div className="relative h-48 w-full">
							<Image
								src={post.imageUrl}
								alt={post.title}
								fill
								className="object-cover"
							/>
						</div>
						<CardHeader>
							<div className="flex justify-between items-center mb-2">
								<Badge variant="secondary" className="bg-teal-50 text-teal-700">
									{post.category}
								</Badge>
								<span className="text-sm text-gray-500">{post.date}</span>
							</div>
							<CardTitle className="text-xl font-bold text-[#1A3434] line-clamp-2">
								{post.title}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600 line-clamp-3">{post.excerpt}</p>
							<Button
								variant="link"
								className="text-teal-600 hover:text-teal-700 p-0 mt-4"
							>
								Read More →
							</Button>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Empty State */}
			{filteredPosts.length === 0 && (
				<div className="text-center py-12">
					<p className="text-gray-500">No posts found in this category.</p>
				</div>
			)}
		</div>
	);
}
