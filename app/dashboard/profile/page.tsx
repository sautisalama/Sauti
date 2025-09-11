"use client";

import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AnonymousModeToggle } from "@/components/chat/AnonymousModeToggle";
import { ProfessionalDocumentsForm } from "./professional-documents";

export default function ProfilePage() {
  const user = useUser();
  const { toast } = useToast();
  const isProfessional = user?.profile?.user_type === "professional" || user?.profile?.user_type === "ngo";

  const onSave = (section: string) => {
    toast({ title: "Saved", description: `${section} updated (UI only)`, });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {/* CTA to unify onboarding/profile */}
        <div className="ml-auto">
          <Button asChild variant="secondary" size="sm">
            <a href="/dashboard/onboarding">Open Profile Setup</a>
          </Button>
        </div>
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={(typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1") ? "/anon.svg" : (user?.profile?.avatar_url || "")} />
            <AvatarFallback className="bg-sauti-orange text-white">
              {user?.profile?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">{user?.profile?.first_name || user?.email || "User"}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-neutral-600">
            {user?.profile?.user_type !== "survivor" && (
              <Badge variant="secondary" className="capitalize">{user?.profile?.user_type || "member"}</Badge>
            )}
            <span className="text-neutral-400">•</span>
            <span>ID: {user?.id?.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue={isProfessional ? "overview" : "about"} className="w-full">
        <TabsList className="w-full overflow-x-auto flex whitespace-nowrap">
          {isProfessional ? (
            <>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="credentials">Credentials</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Professional: Overview */}
        {isProfessional && (
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea placeholder="Short bio, specialties, languages..." rows={4} />
                <div className="flex justify-end">
                  <Button onClick={() => onSave("About")}>Save</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Phone" />
                <Input placeholder="Organization" />
                <Input placeholder="Location / City" />
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={() => onSave("Contact")}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Professional: Credentials */}
        {isProfessional && (
          <TabsContent value="credentials">
            <Card>
              <CardHeader>
                <CardTitle>Credentials & Training</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="Certification / License" />
                <Input placeholder="Issuing Authority" />
                <Input placeholder="Year" />
              </div>
                <Input placeholder="Issuing Authority" />
                <Input placeholder="Year" />
                <Textarea placeholder="Relevant trainings, courses, certificates" rows={4} />
                <div className="flex justify-end">
                  <Button onClick={() => onSave("Credentials")}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Professional: Services */}
        {isProfessional && (
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>Service Offerings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
<div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1.5 rounded-full bg-neutral-100 text-sm">Counseling</button>
                  <button className="px-3 py-1.5 rounded-full bg-neutral-100 text-sm">Legal Aid</button>
                  <button className="px-3 py-1.5 rounded-full bg-neutral-100 text-sm">Shelter</button>
                </div>
                <Input placeholder="Add a service (e.g., Counseling, Legal Aid)" />
                <Textarea placeholder="Service description" rows={3} />
                <div className="flex justify-end">
                  <Button onClick={() => onSave("Services")}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Professional: Availability */}
        {isProfessional && (
          <TabsContent value="availability">
            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="Time zone" />
                  <Input placeholder="Available days (e.g., Mon–Fri)" />
                  <Input placeholder="Available hours (e.g., 09:00–17:00)" />
                </div>
                <p className="text-xs text-neutral-500">This is UI only. Availability does not change scheduling logic.</p>
                <div className="flex justify-end">
                  <Button onClick={() => onSave("Availability")}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Professional: Documents */}
        {isProfessional && (
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Verification Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProfessionalDocumentsForm onSave={() => onSave("Documents")} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Survivor: About & Privacy */}
        {/* Privacy & Identity */}
        <TabsContent value={isProfessional ? "overview" : "about"} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Identity</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.id && user?.profile?.first_name && (
                <AnonymousModeToggle 
                  userId={user.id}
                  username={user.profile.first_name}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!isProfessional && (
          <TabsContent value="about" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About You</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="First Name" defaultValue={user?.profile?.first_name || ""} />
                <Input placeholder="Last Name" defaultValue={user?.profile?.last_name || ""} />
                <Input placeholder="City" />
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={() => onSave("Profile")}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!isProfessional && (
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea placeholder="Notes (UI only)" rows={3} />
                <div className="flex justify-end">
                  <Button onClick={() => onSave("Privacy")}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

