"use client";

import { AppointmentsTab } from "@/app/dashboard/_components/tabs/AppointmentsTab";

export default function AppointmentsClient({ userId, userType, username }: { userId: string; userType: "professional" | "survivor" | string; username: string; }) {
  return (
    <div className="space-y-6">
      <AppointmentsTab
        userId={userId}
        userType={userType === 'professional' || userType === 'ngo' ? 'professional' : 'survivor'}
        username={username}
        onAppointmentsChange={async () => {}}
      />
    </div>
  );
}

