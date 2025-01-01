import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ProfessionalsListProps {
	appointments: any[]; // Using the same type as CalendarView
}

interface Professional {
	id: string;
	profiles?: {
		first_name?: string;
		last_name?: string;
	};
	profession: string;
}

export default function ProfessionalsList({
	appointments,
}: ProfessionalsListProps) {
	// Get unique professionals from appointments
	const professionals = appointments.reduce((acc, appointment) => {
		if (
			appointment.professional_profiles &&
			!acc.some(
				(p: { id: string }) => p.id === appointment.professional_profiles.id
			)
		) {
			acc.push(appointment.professional_profiles);
		}
		return acc;
	}, [] as any[]);

	return (
		<div className="bg-white rounded-lg shadow p-6">
			<h2 className="font-semibold mb-4">Your Professionals</h2>
			<div className="space-y-4">
				{professionals.map((professional: Professional) => (
					<div
						key={professional.id}
						className="flex items-center justify-between p-3 rounded-lg border"
					>
						<div className="flex items-center gap-3">
							<Avatar>
								<AvatarFallback>
									{professional.profiles?.first_name?.[0]}
									{professional.profiles?.last_name?.[0]}
								</AvatarFallback>
							</Avatar>
							<div>
								<p className="font-medium">
									{professional.profiles?.first_name} {professional.profiles?.last_name}
								</p>
								<p className="text-sm text-muted-foreground">
									{professional.profession}
								</p>
							</div>
						</div>
						<Button variant="outline" asChild>
							<Link href={`/chat?professional=${professional.id}`}>Message</Link>
						</Button>
					</div>
				))}
				{professionals.length === 0 && (
					<p className="text-muted-foreground text-sm">
						No previous appointments with professionals
					</p>
				)}
			</div>
		</div>
	);
}
