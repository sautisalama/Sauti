import { Tables } from "@/types/db-schema";
import { cn } from "@/lib/utils";
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
					<h2 className="text-xl font-black text-sauti-dark tracking-tight">Support Services</h2>
					<p className="text-sm text-gray-500">
						{supportServices.length}{" "}
						{supportServices.length === 1 ? "service" : "services"} registered
					</p>
				</div>
				<Button onClick={() => setOpen(true)} className="bg-sauti-teal hover:bg-sauti-dark text-white font-bold rounded-full px-6 transition-all duration-300 shadow-md">
					<Plus className="h-4 w-4 mr-2" />
					Add Service
				</Button>
			</div>

			{supportServices.length > 0 ? (
				<div className="space-y-3">
					{supportServices.map((service) => (
						<div
							key={service.id}
							className="flex items-center justify-between rounded-2xl p-6 bg-sauti-teal-light border-0 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group"
						>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sauti-teal/40" />
							<div className="space-y-2 relative z-10">
								<h4 className="font-black text-sauti-dark text-lg tracking-tight">{service.name}</h4>
								<div className="flex items-center gap-2 text-sm text-neutral-500">
									<span className="px-3 py-1 rounded-full bg-white text-sauti-teal text-[10px] font-black uppercase tracking-wider shadow-sm">
										{formatServiceName(service.service_types)}
									</span>
									{service.phone_number && <span className="font-bold text-sauti-dark/60 ml-2 flex items-center gap-1"><span className="text-sauti-teal">📞</span> {service.phone_number}</span>}
								</div>
								{service.availability && (
									<p className="text-sm font-bold text-sauti-dark/50 flex items-center gap-1">
                    <span className="text-sauti-teal">🕒</span> {service.availability}
                  </p>
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
				<DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px] h-[90vh] min-h-[600px]">
					<DialogTitle className="sr-only">Add Support Service</DialogTitle>
					<DialogDescription className="sr-only">
						Tell us about your support service. Fill in the details below to register
						your service.
					</DialogDescription>
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
