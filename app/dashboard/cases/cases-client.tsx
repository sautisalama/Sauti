"use client";

import { useEffect, useState } from "react";
import { MatchedServiceWithRelations } from "@/app/dashboard/_types";
import { fetchMatchedServices } from "@/app/dashboard/_views/actions/matched-services";
import CasesMasterDetail from "./cases-master-detail";

export default function CasesClient({ userId }: { userId: string }) {
  return (
    <div className="space-y-6">
      <CasesMasterDetail userId={userId} />
    </div>
  );
}

