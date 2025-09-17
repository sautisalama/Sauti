"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Database } from "@/types/db-schema";
import { serviceValidationService } from "@/lib/service-validation";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { fileUploadService } from "@/lib/file-upload";
import { createClient } from "@/utils/supabase/client";
import {
	MapPin,
	Globe,
	Phone,
	Clock,
	Building2,
	Mail,
	Globe2,
	Video,
	MessageCircle,
	Plus,
	Loader2,
	AlertCircle,
	CheckCircle,
	FileText,
	Upload,
	Trash2,
	X,
	Link,
} from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

type ServiceType = Database["public"]["Enums"]["support_service_type"];

const SERVICE_OPTIONS = [
	{ value: "legal", label: "Legal Support" },
	{ value: "medical", label: "Medical Care" },
	{ value: "mental_health", label: "Mental Health Support" },
	{ value: "shelter", label: "Shelter Services" },
	{ value: "financial_assistance", label: "Financial Assistance" },
	{ value: "other", label: "Other Support Services" },
] as const;

const AVAILABILITY_OPTIONS = [
	{ value: "24/7", label: "24/7 Emergency Support" },
	{ value: "weekdays_9_5", label: "Weekdays (9 AM - 5 PM)" },
	{ value: "weekdays_extended", label: "Weekdays (8 AM - 8 PM)" },
	{ value: "weekends", label: "Weekends Only" },
	{ value: "by_appointment", label: "By Appointment" },
	{ value: "flexible", label: "Flexible Hours" },
] as const;

const COVERAGE_OPTIONS = [
	{ value: "5", label: "5 kilometers" },
	{ value: "10", label: "10 kilometers" },
	{ value: "25", label: "25 kilometers" },
	{ value: "50", label: "50 kilometers" },
	{ value: "100", label: "100 kilometers" },
] as const;

export function AddSupportServiceForm({
	onSuccess,
}: {
	onSuccess?: () => void;
}) {
	const { toast } = useToast();
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const [loading, setLoading] = useState(false);
	const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
		null
	);
	const [existingServices, setExistingServices] = useState<ServiceType[]>([]);
	const [validationResult, setValidationResult] = useState<{
		valid: boolean;
		reason?: string;
		suggestions?: string[];
	} | null>(null);
	const [previousDocuments, setPreviousDocuments] = useState<any[]>([]);
	const [documents, setDocuments] = useState<
		{
			id: string;
			title: string;
			file: File | null;
			note?: string;
			uploaded: boolean;
			url?: string;
			isLinked?: boolean;
			originalDocId?: string;
		}[]
	>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		service_types: "" as ServiceType,
		phone_number: "",
		email: "",
		website: "",
		availability: "",
		coverage_area_radius: "",
		is_remote: false,
	});

	useEffect(() => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLocation({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
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
	}, [toast]);

	const loadExistingServices = async () => {
		try {
			const response = await fetch("/api/support-services");
			if (response.ok) {
				const services = await response.json();
				const serviceTypes = services.map((service: any) => service.service_types);
				setExistingServices(serviceTypes);
			}
		} catch (error) {
			console.error("Error loading existing services:", error);
		}
	};

	const loadPreviousDocuments = useCallback(async () => {
		if (!profile?.id) return;

		try {
			const supabase = createClient();
			const { data } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", profile.id)
				.single();

			if (data?.accreditation_files_metadata) {
				const docs = Array.isArray(data.accreditation_files_metadata)
					? data.accreditation_files_metadata
					: JSON.parse(data.accreditation_files_metadata);
				setPreviousDocuments(docs || []);
			}
		} catch (error) {
			console.error("Error loading previous documents:", error);
		}
	}, [profile?.id]);

	const addDocument = () => {
		const newDoc = {
			id: `doc-${Date.now()}`,
			title: "",
			file: null,
			note: "",
			uploaded: false,
		};
		setDocuments([...documents, newDoc]);
	};

	const removeDocument = (id: string) => {
		setDocuments(documents.filter((doc) => doc.id !== id));
	};

	const updateDocument = (id: string, field: string, value: any) => {
		setDocuments(
			documents.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc))
		);
	};

	const linkPreviousDocument = (docId: string, originalDoc: any) => {
		const linkedDoc = {
			id: `linked-${Date.now()}`,
			title: originalDoc.title,
			file: null,
			note: originalDoc.note || "",
			uploaded: true,
			url: originalDoc.url,
			isLinked: true,
			originalDocId: docId,
		};
		setDocuments([...documents, linkedDoc]);
	};

	const uploadDocument = async (doc: any) => {
		if (!doc.file || !profile?.id) return null;

		try {
			const result = await fileUploadService.uploadFile({
				userId: profile.id,
				userType: profile.user_type || "professional",
				serviceId: undefined, // Will be set after service creation
				serviceType: formData.service_types,
				fileType: "accreditation",
				fileName: doc.file.name,
				file: doc.file,
			});
			return result.url;
		} catch (error) {
			console.error("Error uploading document:", error);
			throw error;
		}
	};

	// Drag and drop handlers
	const handleDragOver = (e: React.DragEvent, docId: string) => {
		e.preventDefault();
		setDragOverDocId(docId);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOverDocId(null);
	};

	const handleDrop = (e: React.DragEvent, docId: string) => {
		e.preventDefault();
		setDragOverDocId(null);

		const droppedFiles = Array.from(e.dataTransfer.files);
		if (droppedFiles.length > 0) {
			const droppedFile = droppedFiles[0];
			// Validate file type
			const allowedTypes = [
				"application/pdf",
				"image/jpeg",
				"image/jpg",
				"image/png",
				"image/webp",
				"application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			];

			if (allowedTypes.includes(droppedFile.type)) {
				updateDocument(docId, "file", droppedFile);
				// Auto-fill title if empty
				const doc = documents.find((d) => d.id === docId);
				if (doc && !doc.title) {
					updateDocument(docId, "title", droppedFile.name.replace(/\.[^/.]+$/, ""));
				}
			} else {
				toast({
					title: "Invalid File Type",
					description: "Please select a valid file type (PDF, JPG, PNG, DOC, DOCX)",
					variant: "destructive",
				});
			}
		}
	};

	const validateService = useCallback(() => {
		if (!formData.service_types || !profile?.user_type) return;

		const validation = serviceValidationService.validateServiceCreation(
			existingServices,
			formData.service_types,
			profile.user_type
		);

		setValidationResult(validation);
	}, [formData.service_types, profile?.user_type, existingServices]);

	// Load existing services for validation
	useEffect(() => {
		if (profile?.user_type === "ngo") {
			loadExistingServices();
		}
	}, [profile?.user_type]);

	// Load previous documents when service type changes
	useEffect(() => {
		if (formData.service_types && profile?.id) {
			loadPreviousDocuments();
		}
	}, [formData.service_types, profile?.id, loadPreviousDocuments]);

	// Validate service when service type changes
	useEffect(() => {
		if (formData.service_types && profile?.user_type) {
			validateService();
		}
	}, [
		formData.service_types,
		profile?.user_type,
		existingServices,
		validateService,
	]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Check validation before submitting
		if (validationResult && !validationResult.valid) {
			toast({
				title: "Service Validation Failed",
				description: validationResult.reason,
				variant: "destructive",
			});
			return;
		}

		setLoading(true);

		// Validate that at least one service type is selected
		const hasLocalServices =
			formData.coverage_area_radius && formData.coverage_area_radius !== "";
		const hasRemoteServices = formData.is_remote;

		if (!hasLocalServices && !hasRemoteServices) {
			toast({
				title: "Service type required",
				description: "Please select at least one service type (Local or Remote).",
				variant: "destructive",
			});
			setLoading(false);
			return;
		}

		// Validate location for local services
		if (hasLocalServices && !location) {
			toast({
				title: "Location required",
				description: "Please allow location access for local services.",
				variant: "destructive",
			});
			setLoading(false);
			return;
		}

		try {
			// First create the service
			const serviceData = {
				...formData,
				latitude: hasLocalServices ? location?.lat : null,
				longitude: hasLocalServices ? location?.lng : null,
				coverage_area_radius: hasLocalServices
					? Number(formData.coverage_area_radius)
					: null,
			};

			const response = await fetch("/api/support-services", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(serviceData),
			});

			if (!response.ok) throw new Error("Failed to add service");

			const newService = await response.json();

			// Upload documents if any
			if (documents.length > 0) {
				setIsUploading(true);
				const uploadedDocs = [];

				for (const doc of documents) {
					if (doc.isLinked) {
						// Link existing document
						uploadedDocs.push({
							title: doc.title,
							note: doc.note,
							url: doc.url,
							uploaded: true,
							serviceId: newService.id,
							serviceType: formData.service_types,
						});
					} else if (doc.file) {
						// Upload new document
						const url = await uploadDocument(doc);
						if (url) {
							uploadedDocs.push({
								title: doc.title,
								note: doc.note,
								url: url,
								uploaded: true,
								serviceId: newService.id,
								serviceType: formData.service_types,
							});
						}
					}
				}

				// Update service with documents
				if (uploadedDocs.length > 0) {
					const updateResponse = await fetch(
						`/api/support-services/${newService.id}`,
						{
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								accreditation_files_metadata: uploadedDocs,
							}),
						}
					);

					if (!updateResponse.ok) {
						console.error("Failed to update service with documents");
					}
				}
			}

			toast({
				title: "Success",
				description:
					"Support service has been successfully added with accreditation documents.",
			});

			onSuccess?.();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to add support service. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
			setIsUploading(false);
		}
	};

	return (
		<>
			<style jsx>{`
				.slider::-webkit-slider-thumb {
					appearance: none;
					height: 20px;
					width: 20px;
					border-radius: 50%;
					background: #3b82f6;
					cursor: pointer;
					border: 2px solid #ffffff;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}
				.slider::-moz-range-thumb {
					height: 20px;
					width: 20px;
					border-radius: 50%;
					background: #3b82f6;
					cursor: pointer;
					border: 2px solid #ffffff;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}
			`}</style>
			<Card className="w-full max-w-5xl mx-auto max-h-[80vh] flex flex-col">
				<CardHeader className="text-center pb-4 flex-shrink-0">
					<CardTitle className="text-xl md:text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
						<Building2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
						Register Your Support Service
					</CardTitle>
					<CardDescription className="text-sm text-gray-600">
						Help survivors by registering your support service. Fill in the details
						below to get started.
					</CardDescription>
				</CardHeader>

				<CardContent className="flex-1 overflow-y-auto px-4 md:px-6">
					<form onSubmit={handleSubmit} className="space-y-6">
						{/* Basic Information */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-3">
								<Building2 className="h-4 w-4 text-blue-600" />
								<h3 className="text-base font-semibold text-gray-900">
									Basic Information
								</h3>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="name" className="text-sm font-medium text-gray-700">
										Organization / Service Name *
									</Label>
									<Input
										id="name"
										type="text"
										placeholder="e.g., SafeCare Counseling Center"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
										className="h-10"
									/>
								</div>

								<div className="space-y-2">
									<Label
										htmlFor="service_types"
										className="text-sm font-medium text-gray-700"
									>
										Service Type *
									</Label>
									<select
										id="service_types"
										value={formData.service_types}
										onChange={(e) =>
											setFormData({
												...formData,
												service_types: e.target.value as ServiceType,
											})
										}
										required
										className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent relative z-10"
									>
										<option value="">Select a service type</option>
										{SERVICE_OPTIONS.map(({ value, label }) => (
											<option key={value} value={value}>
												{label}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>

						{/* Contact Information */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-3">
								<Phone className="h-4 w-4 text-blue-600" />
								<h3 className="text-base font-semibold text-gray-900">
									Contact Information
								</h3>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label
										htmlFor="phone_number"
										className="text-sm font-medium text-gray-700"
									>
										Phone Number *
									</Label>
									<Input
										id="phone_number"
										type="tel"
										placeholder="+254 700 000 000"
										value={formData.phone_number}
										onChange={(e) =>
											setFormData({ ...formData, phone_number: e.target.value })
										}
										required
										className="h-10"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="email" className="text-sm font-medium text-gray-700">
										Email Address
									</Label>
									<Input
										id="email"
										type="email"
										placeholder="contact@yourorganization.org"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										className="h-10"
									/>
								</div>

								<div className="space-y-2 md:col-span-2">
									<Label htmlFor="website" className="text-sm font-medium text-gray-700">
										Website (Optional)
									</Label>
									<Input
										id="website"
										type="url"
										placeholder="https://www.yourorganization.org"
										value={formData.website}
										onChange={(e) =>
											setFormData({ ...formData, website: e.target.value })
										}
										className="h-10"
									/>
								</div>
							</div>
						</div>

						{/* Service Availability */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-3">
								<Clock className="h-4 w-4 text-blue-600" />
								<h3 className="text-base font-semibold text-gray-900">
									Service Availability
								</h3>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="availability"
									className="text-sm font-medium text-gray-700"
								>
									When are you typically available? *
								</Label>
								<select
									id="availability"
									value={formData.availability}
									onChange={(e) =>
										setFormData({ ...formData, availability: e.target.value })
									}
									required
									className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent relative z-10"
								>
									<option value="">Select your availability</option>
									{AVAILABILITY_OPTIONS.map(({ value, label }) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* Service Coverage */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-3">
								<MapPin className="h-4 w-4 text-blue-600" />
								<h3 className="text-base font-semibold text-gray-900">
									Service Coverage
								</h3>
							</div>

							{/* Service Coverage Options */}
							<div className="space-y-3">
								<Label className="text-sm font-medium text-gray-700">
									How do you provide your services? (Select all that apply)
								</Label>

								{/* Coverage Options */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{/* Local Services Option */}
									<div
										className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
											formData.coverage_area_radius && formData.coverage_area_radius !== ""
												? "border-blue-500 bg-blue-50"
												: "border-gray-200 hover:border-gray-300"
										}`}
										onClick={() => {
											if (
												formData.coverage_area_radius &&
												formData.coverage_area_radius !== ""
											) {
												// If local services are enabled, disable them
												setFormData({ ...formData, coverage_area_radius: "" });
											} else {
												// If local services are disabled, enable them with default radius
												setFormData({ ...formData, coverage_area_radius: "5" });
											}
										}}
									>
										<div className="flex items-start gap-3">
											<div
												className={`w-4 h-4 rounded-full border-2 mt-0.5 ${
													formData.coverage_area_radius &&
													formData.coverage_area_radius !== ""
														? "border-blue-500 bg-blue-500"
														: "border-gray-300"
												}`}
											>
												{formData.coverage_area_radius &&
													formData.coverage_area_radius !== "" && (
														<div className="w-2 h-2 bg-white rounded-full m-0.5" />
													)}
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-1">
													<MapPin className="h-4 w-4 text-gray-600" />
													<span className="text-sm font-medium text-gray-900">
														Local Services
													</span>
												</div>
												<p className="text-xs text-gray-600">
													I provide in-person services within a specific area
												</p>
											</div>
										</div>
									</div>

									{/* Remote Services Option */}
									<div
										className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
											formData.is_remote
												? "border-green-500 bg-green-50"
												: "border-gray-200 hover:border-gray-300"
										}`}
										onClick={() =>
											setFormData({ ...formData, is_remote: !formData.is_remote })
										}
									>
										<div className="flex items-start gap-3">
											<div
												className={`w-4 h-4 rounded-full border-2 mt-0.5 ${
													formData.is_remote
														? "border-green-500 bg-green-500"
														: "border-gray-300"
												}`}
											>
												{formData.is_remote && (
													<div className="w-2 h-2 bg-white rounded-full m-0.5" />
												)}
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-1">
													<Globe2 className="h-4 w-4 text-gray-600" />
													<span className="text-sm font-medium text-gray-900">
														Remote Services
													</span>
												</div>
												<p className="text-xs text-gray-600">
													I provide services online, by phone, or video calls
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Local Services Configuration */}
								{formData.coverage_area_radius &&
									formData.coverage_area_radius !== "" && (
										<div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
											<div className="space-y-3">
												<div className="flex items-center gap-2 mb-2">
													<MapPin className="h-4 w-4 text-blue-600" />
													<span className="text-sm font-medium text-blue-900">
														Service Coverage Area
													</span>
												</div>

												{/* Distance Slider */}
												<div className="space-y-2">
													<Label className="text-sm font-medium text-gray-700">
														Maximum Travel Distance: {formData.coverage_area_radius || 5} km
													</Label>
													<input
														type="range"
														min="1"
														max="100"
														value={formData.coverage_area_radius || 5}
														onChange={(e) =>
															setFormData({
																...formData,
																coverage_area_radius: e.target.value,
															})
														}
														className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
														style={{
															background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
																((Number(formData.coverage_area_radius) || 5) / 100) * 100
															}%, #e5e7eb ${
																((Number(formData.coverage_area_radius) || 5) / 100) * 100
															}%, #e5e7eb 100%)`,
														}}
													/>
													<div className="flex justify-between text-xs text-gray-500">
														<span>1 km</span>
														<span>100 km</span>
													</div>
												</div>

												{/* Quick Distance Buttons */}
												<div className="flex flex-wrap gap-2">
													{[5, 10, 25, 50].map((distance) => (
														<button
															key={distance}
															type="button"
															onClick={() =>
																setFormData({
																	...formData,
																	coverage_area_radius: distance.toString(),
																})
															}
															className={`px-3 py-1 text-xs rounded-full border transition-colors ${
																Number(formData.coverage_area_radius) === distance
																	? "bg-blue-500 text-white border-blue-500"
																	: "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
															}`}
														>
															{distance} km
														</button>
													))}
												</div>

												<p className="text-xs text-blue-700">
													Survivors within this distance will be able to find your service
												</p>
											</div>
										</div>
									)}

								{/* Combined Services Info */}
								{formData.is_remote &&
									formData.coverage_area_radius &&
									formData.coverage_area_radius !== "" && (
										<div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
											<div className="flex items-center gap-2 mb-2">
												<div className="flex items-center gap-1">
													<MapPin className="h-4 w-4 text-blue-600" />
													<Globe2 className="h-4 w-4 text-green-600" />
												</div>
												<span className="text-sm font-medium text-gray-900">
													Hybrid Service Provider
												</span>
											</div>
											<p className="text-xs text-gray-600">
												You offer both local services within {formData.coverage_area_radius}{" "}
												km and remote services worldwide.
											</p>
										</div>
									)}

								{/* Remote Services Configuration */}
								{formData.is_remote && (
									<div className="bg-green-50 rounded-lg p-4 border border-green-200">
										<div className="space-y-3">
											<div className="flex items-center gap-2 mb-2">
												<Globe2 className="h-4 w-4 text-green-600" />
												<span className="text-sm font-medium text-green-900">
													Remote Service Options
												</span>
											</div>

											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												{[
													{ icon: Phone, label: "Phone Calls", desc: "Voice consultations" },
													{ icon: Video, label: "Video Calls", desc: "Face-to-face online" },
													{
														icon: MessageCircle,
														label: "Chat Support",
														desc: "Text-based help",
													},
													{
														icon: Mail,
														label: "Email Support",
														desc: "Written communication",
													},
												].map(({ icon: Icon, label, desc }) => (
													<div
														key={label}
														className="flex items-center gap-2 p-2 bg-white rounded border border-green-200"
													>
														<Icon className="h-4 w-4 text-green-600" />
														<div>
															<span className="text-sm font-medium text-gray-900">
																{label}
															</span>
															<p className="text-xs text-gray-600">{desc}</p>
														</div>
													</div>
												))}
											</div>

											<p className="text-xs text-green-700">
												Your service will be available to survivors worldwide through remote
												channels
											</p>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Accreditation Documents */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-3">
								<FileText className="h-4 w-4 text-blue-600" />
								<h3 className="text-base font-semibold text-gray-900">
									Accreditation Documents
								</h3>
							</div>

							{/* Previous Documents Section */}
							{previousDocuments.length > 0 && (
								<div className="space-y-3">
									<Label className="text-sm font-medium text-gray-700">
										Link Previous Documents
									</Label>
									<p className="text-xs text-gray-600">
										You can link previously uploaded documents that are relevant to this
										service type.
									</p>
									<div className="grid gap-2 max-h-32 overflow-y-auto">
										{previousDocuments.map((doc, index) => (
											<div
												key={index}
												className="flex items-center justify-between p-2 bg-gray-50 rounded border"
											>
												<div className="flex items-center gap-2">
													<FileText className="h-4 w-4 text-gray-600" />
													<div>
														<p className="text-sm font-medium">{doc.title}</p>
														<p className="text-xs text-gray-500">
															{doc.serviceType ? doc.serviceType.replace("_", " ") : "General"}
														</p>
													</div>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => linkPreviousDocument(`prev-${index}`, doc)}
													className="gap-1"
												>
													<Link className="h-3 w-3" />
													Link
												</Button>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Document Upload Section */}
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium text-gray-700">
										Upload New Documents
									</Label>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={addDocument}
										className="gap-1"
									>
										<Plus className="h-3 w-3" />
										Add Document
									</Button>
								</div>

								{documents.length === 0 ? (
									<div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
										<FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
										<p className="text-sm text-gray-500">
											No documents added yet. Click "Add Document" to upload accreditation
											files.
										</p>
									</div>
								) : (
									<div className="space-y-3">
										{documents.map((doc) => (
											<div key={doc.id} className="p-3 bg-white rounded-lg border">
												<div className="space-y-3">
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<FileText className="h-4 w-4 text-gray-600" />
															{doc.isLinked && (
																<Badge variant="outline" className="text-xs">
																	<Link className="h-3 w-3 mr-1" />
																	Linked
																</Badge>
															)}
														</div>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => removeDocument(doc.id)}
															className="text-red-600 hover:text-red-700"
														>
															<X className="h-4 w-4" />
														</Button>
													</div>

													<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
														<Input
															placeholder="Document title (e.g., License, Certificate)"
															value={doc.title}
															onChange={(e) => updateDocument(doc.id, "title", e.target.value)}
															className="h-9"
														/>
														<div className="flex items-center gap-2">
															{/* Drag and Drop File Input */}
															<div
																className={`flex-1 border-2 border-dashed rounded-md p-3 text-center transition-colors cursor-pointer ${
																	dragOverDocId === doc.id
																		? "border-sauti-orange bg-orange-50"
																		: doc.file
																		? "border-green-300 bg-green-50"
																		: "border-gray-300 hover:border-gray-400"
																}`}
																onDragOver={(e) => handleDragOver(e, doc.id)}
																onDragLeave={handleDragLeave}
																onDrop={(e) => handleDrop(e, doc.id)}
																onClick={(e) => {
																	e.preventDefault();
																	document.getElementById(`file-upload-${doc.id}`)?.click();
																}}
																onTouchEnd={(e) => {
																	e.preventDefault();
																	document.getElementById(`file-upload-${doc.id}`)?.click();
																}}
															>
																{doc.file ? (
																	<div className="space-y-1">
																		<FileText className="h-5 w-5 text-green-600 mx-auto" />
																		<p className="text-xs font-medium text-green-800 truncate">
																			{doc.file.name}
																		</p>
																		<p className="text-xs text-green-600">
																			{(doc.file.size / 1024 / 1024).toFixed(2)} MB
																		</p>
																	</div>
																) : (
																	<div className="space-y-1">
																		<Upload className="h-5 w-5 text-gray-400 mx-auto" />
																		<p className="text-xs text-gray-600">
																			<span className="font-medium text-sauti-orange">Click</span>{" "}
																			or drag file
																		</p>
																		<p className="text-xs text-gray-500">
																			PDF, JPG, PNG, DOC, DOCX
																		</p>
																	</div>
																)}
																<input
																	type="file"
																	onChange={(e) =>
																		updateDocument(doc.id, "file", e.target.files?.[0] || null)
																	}
																	accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
																	className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
																	disabled={doc.isLinked}
																/>
															</div>
															{doc.uploaded && (
																<Badge
																	variant="outline"
																	className="text-green-600 border-green-200"
																>
																	<CheckCircle className="h-3 w-3 mr-1" />
																	Uploaded
																</Badge>
															)}
														</div>
													</div>

													<Textarea
														placeholder="Notes (optional)"
														value={doc.note || ""}
														onChange={(e) => updateDocument(doc.id, "note", e.target.value)}
														className="min-h-[60px] resize-none"
													/>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Submit Button */}
						<div className="flex justify-center pt-4 sticky bottom-0 bg-white border-t border-gray-200 -mx-4 md:-mx-6 px-4 md:px-6 py-3">
							<Button
								type="submit"
								disabled={loading || isUploading}
								className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 h-10 text-sm font-medium"
							>
								{loading || isUploading ? (
									<div className="flex items-center gap-2">
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
										{isUploading ? "Uploading Documents..." : "Registering Service..."}
									</div>
								) : (
									"Register Support Service"
								)}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</>
	);
}
