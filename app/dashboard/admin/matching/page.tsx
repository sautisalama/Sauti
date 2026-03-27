import { getReportedCases } from "./_actions";
import VisualizerClientWrapper from "./_components/VisualizerClientWrapper";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function MatchingVisualizerPage() {
    const cases = await getReportedCases();
    return (
        <div className="flex flex-col h-full min-h-[calc(100vh)] relative overflow-hidden bg-serene-neutral-50 rounded-xl">
            <div className="flex-1 w-full h-[calc(100vh)] overflow-hidden relative">
                <VisualizerClientWrapper initialCases={cases} />
            </div>
        </div>
    );
}
