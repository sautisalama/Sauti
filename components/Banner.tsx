import { CircleUser, Menu, Package2, Phone, Search } from "lucide-react";

export function Banner() {
	return (
		<div className="flex w-full flex-col">
			<header className="text-sm text-white sticky top-0 flex items-center justify-between gap-4 border-b px-4 md:px-6 bg-sauti-blue">
				<div className="flex items-center justify-between gap-12 w-full p-2 md:max-w-[50%] m-auto">
					<p>Our toll free number</p>
					<span className="flex items-center justify-between gap-2">
						<Phone className="h-4 w-4" />
						<a
							href="tel:+254751234567"
							className="hover:underline"
							aria-label="Call us at +254 75 123-4567"
						>
							<p className="text-center md:text-left">+254 75 123-4567</p>
						</a>
					</span>
				</div>
			</header>
		</div>
	);
}
