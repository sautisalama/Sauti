import { Tables } from "@/types/db-schema";
import { MatchCard } from "../../_components/MatchCard";

interface MatchedServiceWithRelations {
  id: string;
  match_date: string;
  match_status_type: string;
  report: Tables<"reports">;
  support_service: Tables<"support_services">;
}

interface MatchedCasesTabProps {
  matchedServices: MatchedServiceWithRelations[];
  onRefresh: () => void;
}

export function MatchedCasesTab({ matchedServices, onRefresh }: MatchedCasesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-[#1A3434]">Matched Cases</h2>
          <p className="text-sm text-gray-500">
            {matchedServices.length}{" "}
            {matchedServices.length === 1 ? "case" : "cases"} matched
          </p>
        </div>
      </div>

      {matchedServices.length > 0 ? (
        <div className="space-y-4">
          {matchedServices.map((matchedCase) => (
            <MatchCard
              key={matchedCase.id}
              match={matchedCase}
              onAccept={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <p className="text-gray-500">No matched cases found</p>
            <p className="text-sm text-gray-400">
              Matches will appear here when your services are matched with reports
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
