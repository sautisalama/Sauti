"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
	Card,
	CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Search,
	MoreHorizontal,
	Eye,
	ChevronLeft,
	ChevronRight,
	Activity,
	Clock,
	AlertCircle,
    ArrowRight,
    MapPin
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type MatchedCase = {
	report_id: string;
	type_of_incident: string | null;
	urgency: string | null;
	submission_timestamp: string | null;
	ismatched: boolean | null;
	latitude: number | null;
	longitude: number | null;
	matched_services?: { id: string; match_status_type: string | null }[];
};

export function AdminCasesTable() {
	const router = useRouter();
	const [cases, setCases] = useState<MatchedCase[]>([]);
	const [filteredCases, setFilteredCases] = useState<MatchedCase[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [urgencyFilter, setUrgencyFilter] = useState("all");
	
	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 8;

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadCases();
	}, []);

	useEffect(() => {
		filterCases();
		setCurrentPage(1);
	}, [cases, searchTerm, urgencyFilter]);

	const loadCases = async () => {
		try {
			setIsLoading(true);
			// Fetch matched cases
			const { data, error } = await supabase
				.from("reports")
				.select(`
                    report_id, 
                    type_of_incident, 
                    urgency, 
                    submission_timestamp, 
                    ismatched,
                    latitude,
                    longitude,
                    matched_services(id, match_status_type)
                `)
				.eq("ismatched", true)
				.order("submission_timestamp", { ascending: false });

			if (error) throw error;
			setCases(data || []);
		} catch (error) {
			console.error("Error loading cases:", error);
			toast({
				title: "Error",
				description: "Failed to load matched cases",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const filterCases = () => {
		let filtered = cases;

		// Search filter (Case ID or Incident Type)
		if (searchTerm) {
			filtered = filtered.filter((c) =>
				`${c.report_id} ${c.type_of_incident || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// Urgency filter
		if (urgencyFilter !== "all") {
			filtered = filtered.filter((c) => c.urgency === urgencyFilter);
		}

		setFilteredCases(filtered);
	};
	
	// Pagination Logic
    const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCases = filteredCases.slice(startIndex, startIndex + itemsPerPage);

	const getUrgencyColor = (urgency: string | null) => {
		switch (urgency?.toLowerCase()) {
			case "high":
				return "bg-red-50 text-red-700 border-red-100";
			case "medium":
				return "bg-amber-50 text-amber-700 border-amber-100";
			case "low":
				return "bg-green-50 text-green-700 border-green-100";
			default:
				return "bg-gray-50 text-gray-700 border-gray-100";
		}
	};

	const handleViewCase = (reportId: string) => {
		router.push(`/dashboard/admin/matching?caseId=${reportId}`);
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="h-20 bg-white rounded-2xl border border-serene-neutral-100 shadow-sm animate-pulse" />
				))}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Filters */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex flex-col sm:flex-row gap-3 flex-1">
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-serene-neutral-400 h-4 w-4" />
						<Input
							placeholder="Search cases or IDs..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 h-10 w-full rounded-xl bg-white border-serene-neutral-200 focus:border-serene-blue-300 focus:ring-4 focus:ring-serene-blue-100 transition-all shadow-sm"
						/>
					</div>

					<Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
						<SelectTrigger className="h-10 w-full sm:w-[130px] rounded-xl bg-white border-serene-neutral-200 shadow-sm">
							<SelectValue placeholder="Urgency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Urgency</SelectItem>
							<SelectItem value="high">High</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="low">Low</SelectItem>
						</SelectContent>
					</Select>
				</div>
                <div className="flex items-center gap-2 text-xs font-medium text-serene-neutral-500 bg-serene-neutral-50 px-3 py-1.5 rounded-lg border border-serene-neutral-100">
                    <Activity className="w-3.5 h-3.5 text-sauti-teal" />
                    {cases.length} Matched Cases Total
                </div>
			</div>

			{/* Cases Table */}
			<Card className="border-none shadow-card rounded-2xl overflow-hidden bg-white">
				<CardContent className="p-0">
                    <div className="hidden md:block">
					    <Table>
						    <TableHeader className="bg-serene-neutral-50/50">
							    <TableRow className="hover:bg-transparent border-b border-serene-neutral-100">
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5 pl-8">Case ID</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Incident Type</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Urgency</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Matched Services</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Wait Time</TableHead>
								    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5 pr-8">Actions</TableHead>
							    </TableRow>
						    </TableHeader>
						    <TableBody className="divide-y divide-serene-neutral-50">
							    {paginatedCases.length > 0 ? (
								    paginatedCases.map((c) => (
									    <TableRow 
                                            key={c.report_id} 
                                            className="group hover:bg-serene-blue-50/30 transition-colors border-none cursor-pointer"
                                            onClick={() => handleViewCase(c.report_id)}
                                        >
										    <TableCell className="py-4 pl-8">
											    <div className="flex flex-col">
                                                    <span className="font-bold text-serene-neutral-900 group-hover:text-serene-blue-700 transition-colors">
                                                        Case #{c.report_id.substring(0, 8)}
                                                    </span>
                                                    <span className="text-[10px] text-serene-neutral-400 font-mono">{c.report_id}</span>
                                                </div>
										    </TableCell>
										    <TableCell className="py-4">
											    <Badge variant="outline" className="capitalize text-serene-neutral-600 border-serene-neutral-200 font-medium bg-white">
												    {c.type_of_incident}
											    </Badge>
										    </TableCell>
										    <TableCell className="py-4">
											    <Badge className={cn("capitalize px-3 py-0.5 rounded-full border shadow-sm", getUrgencyColor(c.urgency))}>
												    {c.urgency}
											    </Badge>
										    </TableCell>
										    <TableCell className="py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge className="bg-serene-blue-50 text-serene-blue-700 border-serene-blue-100 rounded-lg px-2 py-0.5">
                                                        {c.matched_services?.length || 0} Matched
                                                    </Badge>
                                                </div>
										    </TableCell>
										    <TableCell className="py-4 text-sm text-serene-neutral-500">
											    <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 opacity-50" />
                                                    {formatDistanceToNow(new Date(c.submission_timestamp || 0), { addSuffix: true })}
                                                </div>
										    </TableCell>
										    <TableCell className="text-right py-4 pr-8">
											    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
												    <Button
													    variant="ghost"
													    size="sm"
													    onClick={() => handleViewCase(c.report_id)}
                                                        className="text-serene-neutral-400 hover:text-serene-blue-600 hover:bg-serene-blue-50 rounded-lg pr-1"
												    >
													    Visualizer <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
												    </Button>

                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-serene-neutral-600 rounded-full">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-lg border-serene-neutral-100 p-1">
                                                            <DropdownMenuItem onClick={() => handleViewCase(c.report_id)} className="rounded-lg cursor-pointer">
                                                                <Eye className="mr-2 h-3.5 w-3.5" /> Open Visualizer
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
											    </div>
										    </TableCell>
									    </TableRow>
								    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-[400px] text-center text-serene-neutral-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <AlertCircle className="w-8 h-8 opacity-20" />
                                                <p>No matched cases found matching your filters.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
						    </TableBody>
					    </Table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden divide-y divide-serene-neutral-50">
                        {paginatedCases.length > 0 ? (
                            paginatedCases.map((c) => (
                                <div 
                                    key={c.report_id} 
                                    className="p-5 hover:bg-serene-neutral-50/50 transition-colors cursor-pointer"
                                    onClick={() => handleViewCase(c.report_id)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-serene-neutral-900">Case #{c.report_id.substring(0, 8)}</h3>
                                            <p className="text-xs text-serene-neutral-500 capitalize">{c.type_of_incident} • {c.urgency} Urgency</p>
                                        </div>
                                        <Badge className="bg-serene-blue-50 text-serene-blue-700 border-serene-blue-100">
                                            {c.matched_services?.length || 0} Matches
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-serene-neutral-50 text-[10px] text-serene-neutral-400">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <Clock className="w-2.5 h-2.5" /> {formatDistanceToNow(new Date(c.submission_timestamp || 0), { addSuffix: true })}
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-serene-blue-600 px-2 font-bold uppercase tracking-wider">
                                            Visualizer <ArrowRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center text-serene-neutral-400">
                                No cases found.
                            </div>
                        )}
                    </div>
				</CardContent>

                {/* Pagination */}
                <div className="bg-serene-neutral-50/50 border-t border-serene-neutral-100 p-4 flex items-center justify-between">
                    <div className="text-xs text-serene-neutral-500 font-medium">
                        Showing <span className="text-serene-neutral-900 font-semibold">{paginatedCases.length > 0 ? startIndex + 1 : 0}</span> to <span className="text-serene-neutral-900 font-semibold">{Math.min(startIndex + itemsPerPage, filteredCases.length)}</span> of <span className="text-serene-neutral-900 font-semibold">{filteredCases.length}</span> Results
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0 rounded-lg border-serene-neutral-200 hover:bg-white disabled:opacity-50"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-medium text-serene-neutral-600 min-w-[3rem] text-center">
                            {currentPage} / {totalPages || 1}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0 rounded-lg border-serene-neutral-200 hover:bg-white disabled:opacity-50"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
			</Card>
		</div>
	);
}
