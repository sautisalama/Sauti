import { ReportWithRelations, MatchedServiceWithRelations } from "@/app/dashboard/_types";

/**
 * Derives the "True Status" of a report based on its matches and current state.
 * This is the single source of truth for status display across all views.
 */
export function getReportStatus(report: ReportWithRelations): string {
    const matches = report.matched_services || [];
    
    // 1. Completion has highest priority
    if (report.match_status === 'completed' || matches.some(m => m.match_status_type === 'completed')) {
        return 'completed';
    }
    
    // 2. Acceptance / Active state
    if (report.match_status === 'accepted' || matches.some(m => m.match_status_type === 'accepted')) {
        return 'accepted';
    }
    
    // 3. Reschedule logic (if applicable)
    if (matches.some(m => m.match_status_type === 'reschedule_requested')) {
        return 'reschedule_requested';
    }

    // 4. Pending Survivor acceptance of a proposed match
    if (matches.some(m => m.match_status_type === 'pending_survivor')) {
        return 'pending_survivor';
    }

    // 5. General Matched state (Proposed)
    if (matches.length > 0 && matches.some(m => m.match_status_type === 'proposed')) {
        return 'proposed';
    }
    
    // 6. Default to the report's native status or 'pending'
    return report.match_status || 'pending';
}

/**
 * Derives the status for a specific Match (Case).
 * Map specific match statuses to broader UI categories if needed.
 */
export function getMatchStatus(match: MatchedServiceWithRelations): string {
    const status = match.match_status_type;
    
    if (status === 'accepted') return 'accepted';
    return status || 'pending';
}

/**
 * Returns consistent Tailwind classes for status badges based on derived status.
 */
export function getStatusTheme(status: string): string {
    switch (status) {
        case 'completed':
            return "bg-serene-blue-50 text-serene-blue-700 shadow-serene-blue-100/50";
        case 'accepted':
            return "bg-serene-green-50 text-serene-green-700 shadow-serene-green-100/50";
        case 'proposed':
            return "bg-serene-blue-50 text-serene-blue-600 shadow-serene-blue-50/50";
        case 'pending_survivor':
            return "bg-amber-50 text-amber-700 shadow-amber-50/50";
        case 'reschedule_requested':
            return "bg-purple-50 text-purple-700 shadow-purple-50/50";
        case 'declined':
        case 'cancelled':
            return "bg-red-50 text-red-700 shadow-red-50/50";
        default:
            return "bg-serene-neutral-50 text-serene-neutral-600 shadow-serene-neutral-50/50";
    }
}
