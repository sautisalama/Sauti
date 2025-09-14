"use client";

import { AppointmentsTab } from "@/app/dashboard/_components/tabs/AppointmentsTab";
import AppointmentsMasterDetail from "./appointments-master-detail";

export default function AppointmentsClient({ userId, userType, username }: { userId: string; userType: "professional" | "survivor" | string; username: string; }) {
  const normalized = userType === 'professional' || userType === 'ngo' ? 'professional' : 'survivor';
  if (normalized === 'survivor') {
    return <AppointmentsMasterDetail userId={userId} username={username} />;
  }
  return (
    <div className="space-y-6">
      <AppointmentsTab
        userId={userId}
        userType={normalized}
        username={username}
        onAppointmentsChange={async () => {}}
      />
    </div>
  );
}

