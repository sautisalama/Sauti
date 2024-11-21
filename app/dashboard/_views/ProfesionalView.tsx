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

const formatServiceName = (service: string) => {
	return service
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

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

	const fetchData = async () => {
		console.log("Fetching data for professional view...", { userId });

		try {
			// Fetch support services first
			const { data: supportServicesData, error: supportServicesError } =
				await supabase.from("support_services").select("*").eq("user_id", userId);

			if (supportServicesError) {
				console.error("Error fetching support services:", supportServicesError);
				return;
			}

			console.log("Fetched support services:", supportServicesData);
			setSupportServices(supportServicesData || []);

			// Get all service IDs associated with this user
			const serviceIds = supportServicesData?.map((service) => service.id) || [];
			console.log("Service IDs for matching:", serviceIds);

			// Fetch matched cases for all services
			const { data: matchedServicesData, error: matchedServicesError } =
				await supabase
					.from("matched_services")
					.select(
						`
					*,
					reports(
						report_id,
						type_of_incident,
						incident_description,
						urgency,
						required_services,
						submission_timestamp
					)
				`
					)
					.in("service_id", serviceIds)
					.order("match_date", { ascending: false });

			if (matchedServicesError) {
				console.error("Error fetching matched services:", matchedServicesError);
				return;
			}

			console.log("Fetched matched services:", matchedServicesData);
			setMatchedServices(matchedServicesData || []);

			// Fetch other data...
			const { data: reportsData } = await supabase
				.from("reports")
				.select("*")
				.eq("user_id", userId);

			setReports(reportsData || []);
		} catch (error) {
			console.error("Error in fetchData:", error);
			toast({
				title: "Error",
				description: "Failed to fetch data. Please try again.",
				variant: "destructive",
			});
		}
	};

	useEffect(() => {
		fetchData();

		// Set up realtime subscription for matched_services
		const matchedServicesSubscription = supabase
			.channel("matched-services-changes")
			.on(
				"postgres_changes",
				{
					event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
					schema: "public",
					table: "matched_services",
				},
				() => {
					console.log("Matched services changed, refreshing data...");
					fetchData();
				}
			)
			.subscribe();

		// Cleanup subscription when component unmounts
		return () => {
			matchedServicesSubscription.unsubscribe();
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
											Case #{report.report_id.slice(6, 20)}
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
								{report.required_services && (
									<div className="mt-2 flex flex-wrap gap-1">
										{Array.isArray(report.required_services) &&
											report.required_services.map((service: string, index: number) => (
												<span
													key={index}
													className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
												>
													{formatServiceName(service)}
												</span>
											))}
									</div>
								)}
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
										<div className="flex items-center gap-2">
											<h3 className="font-semibold">
												Case #{match.reports.report_id.slice(0, 8)}
											</h3>
											<span
												className={`px-2 py-1 text-xs rounded-full ${
													match.match_status_type === "pending"
														? "bg-yellow-100 text-yellow-800"
														: match.match_status_type === "accepted"
														? "bg-green-100 text-green-800"
														: match.match_status_type === "declined"
														? "bg-red-100 text-red-800"
														: "bg-gray-100 text-gray-800"
												}`}
											>
												{match.match_status_type?.toUpperCase()}
											</span>
										</div>
										<p className="text-sm text-muted-foreground">
											Matched on {new Date(match.match_date || "").toLocaleDateString()}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
											{match.reports.type_of_incident}
										</span>
										<span className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground">
											{match.reports.urgency}
										</span>
									</div>
								</div>
								<div className="mt-4 space-y-2">
									<p className="text-sm line-clamp-2">
										{match.reports.incident_description}
									</p>
									{match.reports.required_services && (
										<div className="flex flex-wrap gap-1">
											{Array.isArray(match.reports.required_services) &&
												match.reports.required_services.map(
													(service: string, index: number) => (
														<span
															key={index}
															className="px-2 py-1 text-xs rounded-full bg-secondary/50 text-secondary-foreground"
														>
															{formatServiceName(service)}
														</span>
													)
												)}
										</div>
									)}
									{match.match_score && (
										<p className="text-sm text-muted-foreground">
											Match Score: {Math.round(match.match_score * 100)}%
										</p>
									)}
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
