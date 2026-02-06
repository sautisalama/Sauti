"use client";

import { useEffect, useState } from "react";
import { Plus, X, Mic, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export function MobileReportFAB() {
  const pathname = usePathname();
  const user = useUser();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "details">("type");
  const [loading, setLoading] = useState(false);

  // Form State
  const [incidentType, setIncidentType] = useState("");
  const [urgency, setUrgency] = useState("");
  const [description, setDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Visibility Logic: Only show on Home or Reports (list)
  // Home: /dashboard
  // Reports: /dashboard/reports
  // NOT on /dashboard/reports/[id] (detail view handles selection)
  // Although master-detail is on same page for desktop, mobile detail view might be overlay.
  // Assuming standard routing: visible on /dashboard and /dashboard/reports
  const isVisible = pathname === "/dashboard" || pathname === "/dashboard/reports";

  if (!isVisible) return null;

  const handleSubmit = async () => {
    if (!incidentType || !urgency) {
      toast({ title: "Missing Information", description: "Please select an incident type and urgency.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Construct payload matching api/reports/route.ts
      const payload = {
        user_id: user?.id,
        first_name: user?.profile?.first_name || "Anonymous",
        type_of_incident: incidentType,
        urgency: urgency,
        incident_description: description,
        submission_timestamp: new Date().toISOString(),
        location: null, // Could add geo if needed
        required_services: [],
        consent: "yes",
        contact_preference: "chat",
        is_onBehalf: false,
        additional_info: { source: "mobile_fab" }
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to submit");

      toast({ title: "Report Submitted", description: "Help is on the way." });
      setOpen(false);
      
      // Reset form
      setStep("type");
      setIncidentType("");
      setUrgency("");
      setDescription("");

    } catch (e) {
      toast({ title: "Error", description: "Could not submit report. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="lg:hidden fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-serene-blue-600 hover:bg-serene-blue-700 text-white z-50 transition-transform active:scale-95"
        >
          <Plus className="h-8 w-8" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-full max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl bottom-0 top-auto translate-y-0 sm:translate-y-[-50%] sm:top-1/2 fixed p-0 gap-0 border-0 sm:border">
        
        {/* Header */}
        <div className="p-4 border-b border-serene-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
           <DialogTitle className="text-lg font-bold text-serene-neutral-900">
             {step === "type" ? "What happened?" : "Add Details"}
           </DialogTitle>
           <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full h-8 w-8">
             <X className="h-5 w-5" />
           </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-6">
           {step === "type" ? (
             <div className="space-y-6">
                <div className="space-y-3">
                   <label className="text-sm font-bold text-serene-neutral-600 uppercase tracking-wider">Urgency Level</label>
                   <div className="grid grid-cols-3 gap-2">
                      {['low', 'medium', 'high'].map(u => (
                        <button
                          key={u}
                          onClick={() => setUrgency(u)}
                          className={`p-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                            urgency === u 
                              ? u === 'high' ? 'border-red-500 bg-red-50 text-red-700' : 
                                u === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700' :
                                'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-serene-neutral-100 bg-white text-serene-neutral-500 hover:border-serene-neutral-200'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-sm font-bold text-serene-neutral-600 uppercase tracking-wider">Incident Type</label>
                   <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'physical', label: 'Physical Abuse' },
                        { id: 'emotional', label: 'Emotional Abuse' },
                        { id: 'sexual', label: 'Sexual Abuse' },
                        { id: 'financial', label: 'Financial Abuse' },
                        { id: 'other', label: 'Other/Unsure' }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setIncidentType(t.id)}
                          className={`p-4 text-left rounded-xl border-2 text-sm font-bold transition-all ${
                            incidentType === t.id
                              ? 'border-serene-blue-600 bg-serene-blue-50 text-serene-blue-800'
                              : 'border-serene-neutral-100 bg-white text-serene-neutral-600 hover:border-serene-neutral-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                   </div>
                </div>

                <Button 
                  className="w-full h-12 text-base font-bold bg-serene-neutral-900 rounded-xl mt-4"
                  disabled={!incidentType || !urgency}
                  onClick={() => setStep("details")}
                >
                  Next
                </Button>
             </div>
           ) : (
             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-sm font-bold text-serene-neutral-600">Short Description (Optional)</label>
                   <Textarea 
                     placeholder="Briefly describe what happened..."
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className="min-h-[120px] rounded-xl border-serene-neutral-200 bg-serene-neutral-50 focus:bg-white text-base p-4"
                   />
                </div>

                <div className="space-y-2">
                   <label className="text-sm font-bold text-serene-neutral-600">Voice Note (Secure)</label>
                   <button
                     onClick={() => setIsRecording(!isRecording)}
                     className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-colors ${
                       isRecording ? 'border-red-400 bg-red-50 text-red-600' : 'border-serene-neutral-200 hover:border-serene-blue-400 text-serene-neutral-500'
                     }`}
                   >
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-100' : 'bg-serene-neutral-100'}`}>
                        <Mic className="h-5 w-5" />
                     </div>
                     <span className="font-bold">{isRecording ? "Tap to Stop Recording" : "Tap to Record Audio"}</span>
                   </button>
                </div>

                <div className="flex gap-3 pt-4">
                   <Button 
                      variant="outline" 
                      className="flex-1 h-12 rounded-xl"
                      onClick={() => setStep("type")}
                   >
                      Back
                   </Button>
                   <Button 
                      className="flex-[2] h-12 bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-xl font-bold shadow-lg shadow-serene-blue-200"
                      onClick={handleSubmit}
                      disabled={loading}
                   >
                      {loading ? "Sending..." : "Submit Report"}
                   </Button>
                </div>
             </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
