"use client";
import { createClient } from "@/utils/supabase/client";
import AddSupportServiceButton from "@/components/AddSupportServiceButton";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
import { useState, useEffect } from "react";
import { Database } from "@/types/db-schema";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type SupportService = Database["public"]["Tables"]["support_services"]["Row"];

export default function ProfessionalView({ userId }: { userId: string }) {
	const [open, setOpen] = useState(false);
	const [appointments, setAppointments] = useState<any[]>([]);
	const [reports, setReports] = useState<any[]>([]);
	const [matchedServices, setMatchedServices] = useState<any[]>([]);
	const [supportServices, setSupportServices] = useState<SupportService[]>([]);
	const supabase = createClient();
	const { toast } = useToast();
	const [deleteReport, setDeleteReport] = useState<string | null>(null);
	const [deleteService, setDeleteService] = useState<string | null>(null);

	const handleDeleteReport = async (reportId: string) => {
		try {
			const response = await fetch(`/api/reports/${reportId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete report");
			}

			toast({
				title: "Report deleted",
				description: "The report has been successfully deleted.",
				variant: "default",
			});

			// Refresh data after successful deletion
			fetchData();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete the report. Please try again.",
				variant: "destructive",
			});
			console.error("Error deleting report:", error);
		}
		setDeleteReport(null);
	};

	const handleDeleteService = async (serviceId: string) => {
		try {
			const response = await fetch(`/api/support-services/${serviceId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete service");
			}

			toast({
				title: "Service deleted",
				description: "The support service has been successfully deleted.",
				variant: "default",
			});

			// Refresh data after successful deletion
			fetchData();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete the service. Please try again.",
				variant: "destructive",
			});
			console.error("Error deleting service:", error);
		}
		setDeleteService(null);
	};

	// Move fetchData outside useEffect so it can be called from handlers
	const fetchData = async () => {
		const [appointmentsRes, reportsRes, matchedServicesRes, supportServicesRes] =
			await Promise.all([
				supabase
					.from("appointments")
					.select(`*, reports:reports(*)`)
					.eq("professional_id", userId),
				supabase.from("reports").select("*").eq("user_id", userId),
				supabase
					.from("matched_services")
					.select(
						`
						*,
						reports(*),
						support_services(*)
					`
					)
					.eq("service_id", userId),
				supabase.from("support_services").select("*").eq("user_id", userId),
			]);

		setAppointments(appointmentsRes.data || []);
		setReports(reportsRes.data || []);
		setMatchedServices(matchedServicesRes.data || []);
		setSupportServices(supportServicesRes.data || []);
	};

	useEffect(() => {
		fetchData();

		// Subscribe to real-time changes
		const reportsChannel = supabase
			.channel("reports_changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "reports",
					filter: `user_id=eq.${userId}`,
				},
				() => {
					fetchData();
				}
			)
			.subscribe();

		const servicesChannel = supabase
			.channel("services_changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "support_services",
					filter: `user_id=eq.${userId}`,
				},
				() => {
					fetchData();
				}
			)
			.subscribe();

		// Cleanup subscriptions
		return () => {
			supabase.removeChannel(reportsChannel);
			supabase.removeChannel(servicesChannel);
		};
	}, [userId]);

	return (
		<div className="space-y-12">
			{/* Your Cases Section */}
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<h2 className="text-2xl font-bold">Your Cases</h2>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Report Abuse
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-4xl">
							<DialogHeader>
								<DialogTitle>Report Abuse</DialogTitle>
								<DialogDescription>
									Please fill out this form to report an incident. All information will
									be kept confidential.
								</DialogDescription>
							</DialogHeader>
							<AuthenticatedReportAbuseForm
								userId={userId}
								onClose={() => setOpen(false)}
							/>
						</DialogContent>
					</Dialog>
				</div>

				{reports && reports.length > 0 ? (
					<div className="grid gap-4">
						{reports.map((report) => (
							<div
								key={report.report_id}
								className="bg-card p-4 rounded-lg border shadow-sm"
							>
								<div className="flex justify-between items-start">
									<div>
										<h3 className="font-semibold">
											Case #{report.report_id.slice(0, 8)}
										</h3>
										<p className="text-sm text-muted-foreground">
											{report.submission_timestamp &&
												new Date(report.submission_timestamp).toLocaleDateString()}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
											{report.type_of_incident}
										</span>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={() => setDeleteReport(report.report_id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<p className="mt-2 text-sm line-clamp-2">
									{report.incident_description}
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="text-muted-foreground">No reports found.</p>
				)}
			</div>

			{/* Your Support Services Section */}
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<h2 className="text-2xl font-bold">Your Support Services</h2>
					<AddSupportServiceButton userId={userId} />
				</div>
				{supportServices && supportServices.length > 0 ? (
					<div className="grid gap-4">
						{supportServices.map((service) => (
							<div
								key={service.id}
								className="bg-card p-4 rounded-lg border shadow-sm"
							>
								<div className="flex justify-between items-start">
									<div>
										<h3 className="font-semibold">{service.name}</h3>
										<p className="text-sm text-muted-foreground">
											{service.service_types}
										</p>
									</div>
									<div className="flex items-center gap-2">
										{service.availability && (
											<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
												{service.availability}
											</span>
										)}
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={() => setDeleteService(service.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div className="mt-2 space-y-1 text-sm">
									{service.helpline && <p>Helpline: {service.helpline}</p>}
									{service.email && <p>Email: {service.email}</p>}
									{service.phone_number && <p>Phone: {service.phone_number}</p>}
									{service.website && <p>Website: {service.website}</p>}
									{service.coverage_area_radius && (
										<p>Coverage Area: {service.coverage_area_radius}km radius</p>
									)}
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="text-muted-foreground">No support services found.</p>
				)}
			</div>

			{/* Matched Cases Section */}
			<div className="space-y-6">
				<h2 className="text-2xl font-bold">Matched Cases</h2>
				{matchedServices && matchedServices.length > 0 ? (
					<div className="grid gap-4">
						{matchedServices.map((match) => (
							<div key={match.id} className="bg-card p-4 rounded-lg border shadow-sm">
								<div className="flex justify-between items-start">
									<div>
										<h3 className="font-semibold">
											Match from {new Date(match.match_date || "").toLocaleDateString()}
										</h3>
										{match.reports && (
											<p className="text-sm text-muted-foreground">
												Case #{match.reports.report_id.slice(0, 8)}
											</p>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="text-muted-foreground">No matched cases found.</p>
				)}
			</div>

			<AlertDialog
				open={!!deleteReport}
				onOpenChange={(open) => !open && setDeleteReport(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the report.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => deleteReport && handleDeleteReport(deleteReport)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!deleteService}
				onOpenChange={(open) => !open && setDeleteService(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the support
							service.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => deleteService && handleDeleteService(deleteService)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
