"use client";

export function RetryButton() {
	return (
		<button
			onClick={() => {
				if (typeof window !== "undefined") {
					window.location.reload();
				}
			}}
			className="bg-[#FC8E00] hover:bg-[#e07d00] text-white px-6 py-3 rounded-md font-medium transition-colors"
		>
			Try again
		</button>
	);
}
