export const dynamic = "force-dynamic";

/** The build the server is running. Open tabs compare it with the one they were loaded from. */
export async function GET() {
	return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? null }, { headers: { "Cache-Control": "no-store" } });
}
