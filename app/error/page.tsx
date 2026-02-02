import { Button } from "@/components/ui/button";
import Link from "next/link";
import Animation from "@/components/LottieWrapper";
import animationData from "@/public/lottie-animations/wellness.json";

export default async function ErrorPage({
	searchParams,
}: {
	searchParams: Promise<{ message?: string }>;
}) {
	const { message } = await searchParams;

	const getErrorContent = () => {
		switch (message) {
			case "account_not_found":
				return {
					title: "Account Not Found",
					description: "Please create an account first to sign in.",
					showCreateAccount: true,
				};
			case "invalid_user_type":
				return {
					title: "Invalid User Type",
					description: "Your account type is invalid. Please sign up again with a valid user type.",
					showCreateAccount: true,
				};
			default:
				return {
					title: "An Error Occurred",
					description: "Something went wrong. Please try again.",
					showCreateAccount: false,
				};
		}
	};

	const errorContent = getErrorContent();

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4">
			<div className="text-center space-y-4">
				<Animation animationData={animationData} />
				<h1 className="text-2xl font-bold">{errorContent.title}</h1>
				<p className="text-muted-foreground">{errorContent.description}</p>
				<div className="space-x-4">
					{errorContent.showCreateAccount && (
						<Button asChild>
							<Link href="/signup">Create Account</Link>
						</Button>
					)}
					<Button variant="outline" asChild>
						<Link href="/">Go Home</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
