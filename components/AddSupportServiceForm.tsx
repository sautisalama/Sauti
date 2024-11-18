"use client";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";

interface AddSupportServiceFormProps {
	onClose: () => void;
	userId: string;
}

export default function AddSupportServiceForm({
	onClose,
	userId,
}: AddSupportServiceFormProps) {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const supabase = createClient();
	const [userLocation, setUserLocation] = useState<{
		latitude: number | null;
		longitude: number | null;
	}>({
		latitude: null,
		longitude: null,
	});

	useEffect(() => {
		const checkAuth = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setIsAuthenticated(!!session);
		};

		checkAuth();
	}, []);

	useEffect(() => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setUserLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					});
				},
				(error) => {
					console.error("Error getting location:", error);
					toast({
						title: "Location Error",
						description: "Unable to get your location. Some features may be limited.",
						variant: "destructive",
					});
				}
			);
		}
	}, []);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);

		if (!isAuthenticated) {
			toast({
				title: "Error",
				description: "You must be logged in to add a service",
				variant: "destructive",
			});
			return;
		}

		setLoading(true);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				throw new Error("No valid session");
			}

			const data = {
				professional_id: userId,
				name: formData.get("service_name")?.toString(),
				service_types: formData.get("service_type")?.toString(),
				phone_number: formData.get("contact_information")?.toString(),
				availability: formData.get("availability")?.toString(),
				latitude: userLocation.latitude,
				longitude: userLocation.longitude,
				email: session.user.email,
				created_at: new Date().toISOString(),
			};

			const response = await fetch("/api/support-services", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(data),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to add service");
			}

			toast({
				title: "Service Added",
				description: "Support service has been successfully added.",
			});

			setTimeout(() => {
				onClose();
			}, 500);
		} catch (error) {
			console.error("Submission error:", error);
			toast({
				title: "Error",
				description:
					error instanceof Error ? error.message : "Failed to add service.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="space-y-4">
				<Input placeholder="Service Name" name="service_name" required />

				<Select name="service_type" required>
					<SelectTrigger>
						<SelectValue placeholder="Service Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="counseling">Counseling</SelectItem>
						<SelectItem value="legal">Legal Support</SelectItem>
						<SelectItem value="medical">Medical Care</SelectItem>
						<SelectItem value="shelter">Shelter</SelectItem>
						<SelectItem value="financial">Financial Aid</SelectItem>
						<SelectItem value="other">Other</SelectItem>
					</SelectContent>
				</Select>

				<Textarea
					placeholder="Service Description"
					name="description"
					required
					className="min-h-[100px]"
				/>

				<Select name="availability" required>
					<SelectTrigger>
						<SelectValue placeholder="Availability" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="24/7">24/7</SelectItem>
						<SelectItem value="weekdays">Weekdays Only</SelectItem>
						<SelectItem value="weekends">Weekends Only</SelectItem>
						<SelectItem value="by_appointment">By Appointment</SelectItem>
					</SelectContent>
				</Select>

				<Input
					placeholder="Contact Information"
					name="contact_information"
					required
				/>

				<Textarea
					placeholder="Eligibility Criteria"
					name="eligibility_criteria"
					className="min-h-[80px]"
				/>

				<Input
					placeholder="Cost (e.g., Free, Sliding Scale, Fixed Rate)"
					name="cost"
					required
				/>

				<Input placeholder="Location" name="location" required />
			</div>

			<div className="pt-4 border-t">
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? "Adding Service..." : "Add Support Service"}
				</Button>
			</div>
		</form>
	);
}
