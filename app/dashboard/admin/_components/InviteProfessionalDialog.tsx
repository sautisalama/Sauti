"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Mail,
  User,
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROFESSIONAL_TITLES = [
  "Doctor",
  "Mental health expert",
  "Lawyer",
  "Paralegal",
  "Human rights defender",
];

const NGO_TITLES = ["Law firm", "Rescue Center", "Hospital/Clinic", "Local NGO"];

interface InviteProfessionalDialogProps {
  onSuccess?: () => void;
}

export function InviteProfessionalDialog({
  onSuccess,
}: InviteProfessionalDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    userType: "" as "professional" | "ngo" | "",
    professionalTitle: "",
    serviceName: "",
  });

  const titleOptions =
    formData.userType === "professional"
      ? PROFESSIONAL_TITLES
      : formData.userType === "ngo"
      ? NGO_TITLES
      : [];

  const isValid =
    !!formData.email &&
    !!formData.firstName &&
    !!formData.lastName &&
    !!formData.userType &&
    !!formData.professionalTitle;

  const handleUserTypeChange = (val: "professional" | "ngo") => {
    setFormData((prev) => ({ ...prev, userType: val, professionalTitle: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/invite-professional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to send invite.",
          variant: "destructive",
        });
        return;
      }

      setSubmitted(true);
      toast({
        title: "Invite Sent!",
        description: `An invitation has been sent to ${formData.email}.`,
      });
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        userType: "",
        professionalTitle: "",
        serviceName: "",
      });
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => (val ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button
          className="h-10 gap-2 rounded-xl bg-sauti-teal hover:bg-sauti-teal/90 text-white font-semibold shadow-sm px-4 transition-all hover:shadow-md"
          id="invite-professional-btn"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Professional</span>
          <span className="sm:hidden">Invite</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl max-w-lg p-0 border-0 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-7 pb-5 border-b border-serene-neutral-100 bg-gradient-to-br from-sauti-teal/5 to-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-sauti-teal/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-sauti-teal" />
            </div>
            <DialogTitle className="text-xl font-bold text-serene-neutral-900 tracking-tight">
              Add a Professional
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-serene-neutral-500 font-medium leading-relaxed">
            The professional will receive an email to set up their password and
            complete their profile. All details you enter will be pre-filled for
            them to verify.
          </DialogDescription>
        </div>

        {submitted ? (
          /* ── Success State ── */
          <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-serene-neutral-900 mb-1">
                Invitation Sent!
              </h3>
              <p className="text-sm text-serene-neutral-500 font-medium">
                An invitation email has been sent to{" "}
                <span className="font-bold text-serene-neutral-800">
                  {formData.email}
                </span>
                . They will receive instructions to set up their password and
                complete their profile.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="mt-2 rounded-xl bg-sauti-teal hover:bg-sauti-teal/90 text-white font-semibold px-6"
            >
              Done
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Account Type */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest">
                Account Type <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleUserTypeChange("professional")}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all flex items-center gap-2.5 text-left",
                    formData.userType === "professional"
                      ? "border-sauti-teal bg-sauti-teal/5 shadow-sm"
                      : "border-serene-neutral-100 hover:border-sauti-teal/30 hover:bg-serene-neutral-50"
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      formData.userType === "professional"
                        ? "bg-sauti-teal text-white"
                        : "bg-serene-neutral-100 text-serene-neutral-400"
                    )}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-serene-neutral-900">
                      Professional
                    </p>
                    <p className="text-[10px] text-serene-neutral-400 font-medium">
                      Individual expert
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleUserTypeChange("ngo")}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all flex items-center gap-2.5 text-left",
                    formData.userType === "ngo"
                      ? "border-sauti-teal bg-sauti-teal/5 shadow-sm"
                      : "border-serene-neutral-100 hover:border-sauti-teal/30 hover:bg-serene-neutral-50"
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      formData.userType === "ngo"
                        ? "bg-sauti-teal text-white"
                        : "bg-serene-neutral-100 text-serene-neutral-400"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-serene-neutral-900">
                      Organisation
                    </p>
                    <p className="text-[10px] text-serene-neutral-400 font-medium">
                      NGO / Institution
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="invite-firstName"
                  className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest"
                >
                  First Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-serene-neutral-400" />
                  <Input
                    id="invite-firstName"
                    placeholder="Jane"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, firstName: e.target.value }))
                    }
                    className="pl-9 h-10 rounded-xl border-serene-neutral-200 bg-serene-neutral-50 focus:border-sauti-teal focus:ring-sauti-teal/10 text-sm font-medium"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="invite-lastName"
                  className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest"
                >
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invite-lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, lastName: e.target.value }))
                  }
                  className="h-10 rounded-xl border-serene-neutral-200 bg-serene-neutral-50 focus:border-sauti-teal focus:ring-sauti-teal/10 text-sm font-medium"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="invite-email"
                className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest"
              >
                Email Address <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-serene-neutral-400" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="jane.doe@organisation.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  className="pl-9 h-10 rounded-xl border-serene-neutral-200 bg-serene-neutral-50 focus:border-sauti-teal focus:ring-sauti-teal/10 text-sm font-medium"
                  required
                />
              </div>
            </div>

            {/* Professional Title */}
            {formData.userType && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest">
                  {formData.userType === "professional"
                    ? "Professional Title"
                    : "Organisation Type"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.professionalTitle}
                  onValueChange={(val) =>
                    setFormData((p) => ({ ...p, professionalTitle: val }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl border-serene-neutral-200 bg-serene-neutral-50 focus:border-sauti-teal text-sm font-medium">
                    <SelectValue
                      placeholder={
                        formData.userType === "professional"
                          ? "Select title..."
                          : "Select type..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-xl border-serene-neutral-100 shadow-xl z-50">
                    {titleOptions.map((t) => (
                      <SelectItem key={t} value={t} className="rounded-lg focus:bg-serene-neutral-50 transition-colors">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Service Name (optional) */}
            <div className="space-y-1.5">
              <Label
                htmlFor="invite-service"
                className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest"
              >
                Service / Organisation Name{" "}
                <span className="text-serene-neutral-400 normal-case font-medium">
                  (optional)
                </span>
              </Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-serene-neutral-400" />
                <Input
                  id="invite-service"
                  placeholder="e.g. Sauti Hope Solutions"
                  value={formData.serviceName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, serviceName: e.target.value }))
                  }
                  className="pl-9 h-10 rounded-xl border-serene-neutral-200 bg-serene-neutral-50 focus:border-sauti-teal focus:ring-sauti-teal/10 text-sm font-medium"
                />
              </div>
              <p className="text-[10px] text-serene-neutral-400 font-medium px-1">
                This will be pre-filled in the onboarding Services step.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1 rounded-xl h-11 border-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-neutral-50 font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="flex-1 rounded-xl h-11 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-bold shadow-lg shadow-sauti-teal/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending&hellip;
                  </>
                ) : (
                  "Send Invite"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
