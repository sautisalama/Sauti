import { NextResponse } from "next/server";
import { checkUnmatchedReports } from "@/app/actions/check-unmatched-reports";

export async function POST() {
	try {
		await checkUnmatchedReports();
		return NextResponse.json({ message: "Reports matching process completed" });
	} catch (error) {
		console.error("Error in matching process:", error);
		return NextResponse.json(
			{ error: "Failed to process report matching" },
			{ status: 500 }
		);
	}
}
