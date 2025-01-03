import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ErrorPage({
	searchParams,
}: {
	searchParams: { message?: string };
}) {
	const message = searchParams.message;

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4">
			<div className="text-center space-y-4">
				<h1 className="text-2xl font-bold">
					{message === "account_not_found"
						? "Account Not Found"
						: "An Error Occurred"}
				</h1>
				<p className="text-muted-foreground">
					{message === "account_not_found"
						? "Please create an account first to sign in."
						: "Something went wrong. Please try again."}
				</p>
				<div className="space-x-4">
					{message === "account_not_found" && (
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
