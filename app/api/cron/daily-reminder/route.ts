import { NextResponse } from "next/server";
import { MailtrapClient } from "mailtrap";

const TOKEN = process.env.MAILTRAP_TOKEN!;
const client = new MailtrapClient({ token: TOKEN });

export const runtime = "edge";

export async function POST(request: Request) {
	try {
		await client.send({
			from: {
				email: "notifications@sautisalama.org",
				name: "Sauti Salama",
			},
			to: [
				{
					email: "oliverwai9na@gmail.com",
					name: "Sauti Salama G",
				},
			],
			subject: "🌅 New Day at Sauti Salama",
			text: `
                Good morning!

                It's a new day to make a difference at Sauti Salama. 
                Let's continue our mission to support and protect those in need.

                Have a productive day!

                Best regards,
                Sauti Salama System
            `.trim(),
			category: "Daily Reminder",
		});

		return NextResponse.json({
			message: "Daily reminder email sent successfully",
		});
	} catch (error) {
		console.error("Failed to send daily reminder:", error);
		return NextResponse.json(
			{
				error: "Failed to send daily reminder",
			},
			{
				status: 500,
			}
		);
	}
}
