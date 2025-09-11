"use client";

import { useEffect, useState } from "react";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { fetchUserSupportServices } from "@/app/dashboard/_views/actions/support-services";
import { createClient } from "@/utils/supabase/client";

export default function ServicesClient({ userId }: { userId: string }) {
  const [services, setServices] = useState<Tables<"support_services">[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const data = await fetchUserSupportServices(userId);
      setServices(data);
    };
    load();

    // Real time updates
    const ch = supabase
      .channel("services")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_services", filter: `user_id=eq.${userId}` }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, supabase]);

  const formatServiceName = (s: string) => s.split("_").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");

  const deleteService = async (id: string) => {
    await fetch(`/api/support-services/${id}`, { method: 'DELETE' }).catch(() => {});
    const data = await fetchUserSupportServices(userId);
    setServices(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A3434]">Support Services</h2>
          <p className="text-sm text-neutral-500">{services.length} {services.length === 1 ? 'service' : 'services'} registered</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Service</Button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border">
          <p className="text-neutral-500">No support services found</p>
          <p className="text-sm text-neutral-400">Click "Add Service" to register your first support service</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between rounded-lg p-4 bg-card border">
              <div className="space-y-1">
                <h4 className="font-medium">{service.name}</h4>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="px-2 py-0.5 rounded-full bg-secondary">{formatServiceName(service.service_types)}</span>
                  {service.phone_number && <span>📞 {service.phone_number}</span>}
                </div>
                {service.availability && (
                  <p className="text-sm text-gray-500">🕒 {service.availability}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteService(service.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Support Service</DialogTitle>
            <DialogDescription>
              Tell us about your support service. Fill in the details below to register your service.
            </DialogDescription>
          </DialogHeader>
          <AddSupportServiceForm onSuccess={() => { setOpen(false); fetchUserSupportServices(userId).then(setServices); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

