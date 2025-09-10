"use client";

import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function SettingsPage() {
  const user = useUser();
  const { toast } = useToast();
  const isProfessional = user?.profile?.user_type === "professional" || user?.profile?.user_type === "ngo";

  const onSave = (section: string) => toast({ title: "Saved", description: `${section} updated (UI only)` });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <Tabs defaultValue={isProfessional ? "account" : "next-of-kin"} className="w-full">
        <TabsList className="w-full overflow-x-auto flex whitespace-nowrap">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          {isProfessional && <TabsTrigger value="availability">Availability</TabsTrigger>}
          {!isProfessional && <TabsTrigger value="next-of-kin">Next of Kin</TabsTrigger>}
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Email" defaultValue={user?.email || ""} disabled />
              <Input placeholder="Phone" />
              <Input placeholder="City" />
              <div className="md:col-span-2 flex justify-end"><Button onClick={() => onSave("Account")}>Save</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Notes (UI only)" rows={3} />
              <div className="flex justify-end"><Button onClick={() => onSave("Preferences")}>Save</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {isProfessional && (
          <TabsContent value="availability">
            <Card>
              <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Time zone" />
                <Input placeholder="Available days" />
                <Input placeholder="Available hours" />
                <div className="md:col-span-2 flex justify-end"><Button onClick={() => onSave("Availability")}>Save</Button></div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!isProfessional && (
          <TabsContent value="next-of-kin">
            <Card>
              <CardHeader><CardTitle>Next-of-Kin</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Full Name" />
                <Input placeholder="Relationship" />
                <Input placeholder="Phone Number" />
                <Input placeholder="Alternate Phone (optional)" />
                <Input placeholder="City / Location" />
                <div className="md:col-span-2">
                  <Textarea placeholder="Notes / Instructions" rows={3} />
                </div>
                <div className="md:col-span-2 flex justify-end"><Button onClick={() => onSave("Next-of-Kin")}>Save</Button></div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

