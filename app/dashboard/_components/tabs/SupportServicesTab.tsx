import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { fetchUserSupportServices } from "../../_views/actions/support-services";

interface SupportServicesTabProps {
	supportServices: Tables<"support_services">[];
	formatServiceName: (service: string) => string;
	onDeleteService: (id: string) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
	userId: string;
	onRefresh: () => Promise<void>;
}

export function SupportServicesTab({
	supportServices,
	formatServiceName,
	onDeleteService,
	open,
	setOpen,
	userId,
	onRefresh,
}: SupportServicesTabProps) {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-xl font-semibold text-[#1A3434]">Support Services</h2>
					<p className="text-sm text-gray-500">
						{supportServices.length}{" "}
						{supportServices.length === 1 ? "service" : "services"} registered
					</p>
				</div>
				<Button onClick={() => setOpen(true)}>
					<Plus className="h-4 w-4 mr-2" />
					Add Service
				</Button>
			</div>

			{supportServices.length > 0 ? (
				<div className="space-y-3">
					{supportServices.map((service) => (
						<div
							key={service.id}
							className="flex items-center justify-between rounded-lg p-4 bg-card border"
						>
							<div className="space-y-1">
								<h4 className="font-medium">{service.name}</h4>
								<div className="flex items-center gap-2 text-sm text-gray-500">
									<span className="px-2 py-0.5 rounded-full bg-secondary">
										{formatServiceName(service.service_types)}
									</span>
									{service.phone_number && <span>📞 {service.phone_number}</span>}
								</div>
								{service.availability && (
									<p className="text-sm text-gray-500">🕒 {service.availability}</p>
								)}
							</div>

							<Button
								variant="ghost"
								size="icon"
								className="text-destructive hover:text-destructive hover:bg-destructive/10"
								onClick={() => onDeleteService(service.id)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
			) : (
				<div className="text-center py-12 bg-gray-50 rounded-lg">
					<div className="space-y-3">
						<p className="text-gray-500">No support services found</p>
						<p className="text-sm text-gray-400">
							Click "Add Service" to register your first support service
						</p>
					</div>
				</div>
			)}

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Add Support Service</DialogTitle>
						<DialogDescription>
							Tell us about your support service. Fill in the details below to register
							your service.
						</DialogDescription>
					</DialogHeader>
					<AddSupportServiceForm
						onSuccess={() => {
							setOpen(false);
							onRefresh();
						}}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
