"use client";

import { useEffect, useState } from "react";
import { MatchedServiceWithRelations } from "@/app/dashboard/_types";
import { fetchMatchedServices } from "@/app/dashboard/_views/actions/matched-services";
import { MatchedCasesTab } from "@/app/dashboard/_components/tabs/MatchedCasesTab";

export default function CasesClient({ userId }: { userId: string }) {
  const [matchedServices, setMatchedServices] = useState<MatchedServiceWithRelations[]>([]);

  const load = async () => {
    const data = await fetchMatchedServices(userId);
    setMatchedServices(data);
  };

  useEffect(() => {
    load();
  }, [userId]);

  return (
    <div className="space-y-6">
      <MatchedCasesTab userId={userId} matchedServices={matchedServices} onRefresh={load} />
    </div>
  );
}

