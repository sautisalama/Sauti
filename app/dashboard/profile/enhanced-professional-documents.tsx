"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Trash2,
	Plus,
	Upload,
	FileText,
	CheckCircle,
	AlertCircle,
	Building,
	Shield,
	X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
	fileUploadService,
	FileUploadError,
	UploadedFile,
} from "@/lib/file-upload";
import { Database } from "@/types/db-schema";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

interface Document {
	id: string;
	title: string;
	note?: string;
	file?: File | null;
	url?: string;
	uploaded?: boolean;
	serviceId?: string;
	serviceType?: SupportServiceType;
}

interface Service {
	id: string;
	name: string;
	serviceType: SupportServiceType;
}

interface EnhancedProfessionalDocumentsFormProps {
	onSave?: () => void;
	initialData?: {
		accreditation_files?: any;
		accreditation_member_number?: any;
	};
	onSaveDocuments?: (documents: any[]) => void;
	userId: string;
	userType: UserType;
	existingServices?: Service[];
}

export function EnhancedProfessionalDocumentsForm({
	onSave,
	initialData,
	onSaveDocuments,
	userId,
	userType,
	existingServices = [],
}: EnhancedProfessionalDocumentsFormProps) {
	const [docs, setDocs] = useState<Document[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [selectedServiceId, setSelectedServiceId] = useState<string>("");
	const [selectedServiceType, setSelectedServiceType] =
		useState<SupportServiceType | null>(null);
	const [services, setServices] = useState<Service[]>(existingServices);
	const [isLoadingServices, setIsLoadingServices] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	const loadServices = useCallback(async () => {
		if (userType !== "ngo") return;

		setIsLoadingServices(true);
		try {
			const { data, error } = await supabase
				.from("support_services")
				.select("id, name, service_types")
				.eq("user_id", userId);

			if (error) throw error;

			setServices(
				data?.map((service) => ({
					id: service.id,
					name: service.name,
					serviceType: service.service_types,
				})) || []
			);
		} catch (error) {
			console.error("Error loading services:", error);
			toast({
				title: "Error",
				description: "Failed to load services",
				variant: "destructive",
			});
		} finally {
			setIsLoadingServices(false);
		}
	}, [userType, userId, supabase, toast]);

	// Load existing services
	useEffect(() => {
		loadServices();
	}, [loadServices]);

	// Load existing documents from initialData
	useEffect(() => {
		if (initialData?.accreditation_files) {
			try {
				const existingDocs = Array.isArray(initialData.accreditation_files)
					? initialData.accreditation_files
					: JSON.parse(initialData.accreditation_files);

				if (existingDocs.length > 0) {
					setDocs(
						existingDocs.map((doc: any, index: number) => ({
							id: `existing-${index}`,
							title: doc.title || "",
							note: doc.note || "",
							file: null,
							url: doc.url || "",
							uploaded: true,
							serviceId: doc.serviceId,
							serviceType: doc.serviceType,
						}))
					);
				}
			} catch (error) {
				console.error("Error parsing existing documents:", error);
			}
		}
	}, [initialData]);

	const addDoc = () => {
		if (userType === "ngo" && !selectedServiceId) {
			toast({
				title: "Service Required",
				description: "Please select a service before adding documents",
				variant: "destructive",
			});
			return;
		}

		const newDoc: Document = {
			id: `new-${Date.now()}`,
			title: "",
			note: "",
			file: undefined,
			uploaded: false,
			serviceId: selectedServiceId || undefined,
			serviceType: selectedServiceType || undefined,
		};

		setDocs((prev) => [...prev, newDoc]);
	};

	const removeDoc = (id: string) => {
		setDocs((prev) => prev.filter((doc) => doc.id !== id));
	};

	const updateDoc = (id: string, patch: Partial<Document>) => {
		setDocs((prev) =>
			prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc))
		);
	};

	const handleServiceChange = (serviceId: string) => {
		setSelectedServiceId(serviceId);
		const service = services.find((s) => s.id === serviceId);
		setSelectedServiceType(service?.serviceType || null);
	};

	const uploadFile = async (
		file: File,
		doc: Document
	): Promise<string | null> => {
		try {
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				serviceId: doc.serviceId,
				serviceType: doc.serviceType,
				fileType: "accreditation",
				fileName: file.name,
				file,
			});

			return result.url;
		} catch (error) {
			if (error instanceof FileUploadError) {
				toast({
					title: "Upload Error",
					description: error.message,
					variant: "destructive",
				});
			} else {
				toast({
					title: "Upload Error",
					description: "Failed to upload file. Please try again.",
					variant: "destructive",
				});
			}
			return null;
		}
	};

	const handleSave = async () => {
		setIsUploading(true);
		try {
			const documentsToSave: any[] = [];

			for (const doc of docs) {
				if (!doc.title.trim()) continue;

				const documentData: any = {
					title: doc.title,
					note: doc.note || "",
					serviceId: doc.serviceId,
					serviceType: doc.serviceType,
				};

				// If there's a new file to upload
				if (doc.file && !doc.uploaded) {
					const url = await uploadFile(doc.file, doc);
					if (url) {
						documentData.url = url;
						documentData.uploaded = true;
					} else {
						continue;
					}
				} else if (doc.url) {
					documentData.url = doc.url;
					documentData.uploaded = true;
				}

				documentsToSave.push(documentData);
			}

			// Update the document state with uploaded URLs
			setDocs((prevDocs) =>
				prevDocs.map((doc) => {
					const savedDoc = documentsToSave.find(
						(saved) => saved.title === doc.title && saved.serviceId === doc.serviceId
					);
					return savedDoc ? { ...doc, ...savedDoc } : doc;
				})
			);

			// Call the parent component's save function
			if (onSaveDocuments) {
				onSaveDocuments(documentsToSave);
			}

			if (onSave) {
				onSave();
			}
		} catch (error) {
			console.error("Error saving documents:", error);
			// Error handling is done by the parent component
			throw error; // Re-throw so parent can handle it
		} finally {
			setIsUploading(false);
		}
	};

	const getServiceName = (serviceId?: string) => {
		if (!serviceId) return "General";
		const service = services.find((s) => s.id === serviceId);
		return service?.name || "Unknown Service";
	};

	const getServiceTypeColor = (serviceType?: SupportServiceType) => {
		const colors = {
			legal: "bg-blue-100 text-blue-800",
			medical: "bg-red-100 text-red-800",
			mental_health: "bg-purple-100 text-purple-800",
			shelter: "bg-green-100 text-green-800",
			financial_assistance: "bg-yellow-100 text-yellow-800",
			other: "bg-gray-100 text-gray-800",
		};
		return colors[serviceType || "other"];
	};

	return (
		<div className="space-y-6">
			{/* Service Selection for NGO Users */}
			{userType === "ngo" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Building className="h-5 w-5 text-sauti-orange" />
							Service Selection
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<label className="text-sm font-medium text-gray-600 mb-2 block">
									Select Service for Document Upload
								</label>
								<Select value={selectedServiceId} onValueChange={handleServiceChange}>
									<SelectTrigger>
										<SelectValue placeholder="Choose a service..." />
									</SelectTrigger>
									<SelectContent>
										{services.map((service) => (
											<SelectItem key={service.id} value={service.id}>
												<div className="flex items-center gap-2">
													<span>{service.name}</span>
													<Badge className={getServiceTypeColor(service.serviceType)}>
														{service.serviceType.replace("_", " ")}
													</Badge>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{selectedServiceType && (
								<Alert>
									<Shield className="h-4 w-4" />
									<AlertDescription>
										Uploading documents for{" "}
										<strong>{getServiceName(selectedServiceId)}</strong> service.
										Documents will be organized by service type for easy management.
									</AlertDescription>
								</Alert>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Documents List */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">Accreditation Documents</h3>
					<Button
						type="button"
						variant="secondary"
						onClick={addDoc}
						className="gap-2"
						disabled={userType === "ngo" && !selectedServiceId}
					>
						<Plus className="h-4 w-4" />
						Add Document
					</Button>
				</div>

				{docs.length === 0 ? (
					<Card className="border-dashed">
						<CardContent className="flex flex-col items-center justify-center py-8">
							<FileText className="h-12 w-12 text-gray-400 mb-4" />
							<p className="text-gray-500 text-center">
								No documents uploaded yet. Click "Add Document" to get started.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4">
						{docs.map((doc) => (
							<Card key={doc.id} className="border rounded-lg">
								<CardContent className="p-4 space-y-3">
									{/* Service Badge for NGO users */}
									{userType === "ngo" && doc.serviceId && (
										<div className="flex items-center gap-2 mb-2">
											<Badge className={getServiceTypeColor(doc.serviceType)}>
												{getServiceName(doc.serviceId)}
											</Badge>
											{doc.serviceType && (
												<Badge variant="outline">{doc.serviceType.replace("_", " ")}</Badge>
											)}
										</div>
									)}

									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										<Input
											placeholder="Document title (e.g., License, Certificate)"
											value={doc.title}
											onChange={(e) => updateDoc(doc.id, { title: e.target.value })}
										/>
										<div className="flex items-center gap-2">
											<Input
												type="file"
												onChange={(e) =>
													updateDoc(doc.id, { file: e.target.files?.[0] || null })
												}
												className="flex-1"
												accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
											/>
											{doc.uploaded && (
												<div className="flex items-center gap-1 text-green-600">
													<CheckCircle className="h-4 w-4" />
													<span className="text-xs">Uploaded</span>
												</div>
											)}
										</div>
									</div>

									<div className="flex items-start gap-2">
										<Textarea
											placeholder="Notes (optional)"
											value={doc.note || ""}
											onChange={(e) => updateDoc(doc.id, { note: e.target.value })}
											className="flex-1 min-h-[60px]"
										/>
										<Button
											type="button"
											variant="ghost"
											className="shrink-0 text-destructive p-2"
											onClick={() => removeDoc(doc.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									{doc.url && (
										<div className="flex items-center gap-2 p-2 bg-green-50 rounded border">
											<FileText className="h-4 w-4 text-green-600" />
											<a
												href={doc.url}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm text-green-700 hover:underline flex-1 truncate"
											>
												{doc.title || "Document"}
											</a>
										</div>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>

			{/* Save Button */}
			<div className="flex items-center justify-end gap-2">
				{isUploading && (
					<div className="flex items-center gap-2 text-sm text-gray-600">
						<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sauti-orange"></div>
						Uploading...
					</div>
				)}
				<Button
					type="button"
					onClick={handleSave}
					disabled={isUploading || docs.length === 0}
					className="gap-2"
				>
					<Upload className="h-4 w-4" />
					{isUploading ? "Saving..." : "Save Documents"}
				</Button>
			</div>
		</div>
	);
}
