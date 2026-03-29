"use client";

import { Handle, Position } from "@xyflow/react";
import { ShieldAlert, Activity, UserCheck, Star, AlertTriangle, User, Briefcase, Zap, CheckCircle2, FileText, Scale, Cross, Shield, X, Layers, AlertOctagon, CircleDot } from "lucide-react";

const getIncidentIcon = (incident: string) => {
    switch (incident?.toLowerCase()) {
        case 'physical': return <Zap className="h-4 w-4" />;
        case 'legal': return <Scale className="h-4 w-4" />;
        case 'medical': return <Cross className="h-4 w-4" />;
        case 'shelter': return <Shield className="h-4 w-4" />;
        default: return <FileText className="h-4 w-4" />;
    }
}

export function CaseNode({ data }: { data: any }) {
    const cascadeLevel = data.cascadeLevel || 0;
    const requiresReview = data.requiresManualReview;
    
    return (
        <div className="w-72 bg-white border border-serene-neutral-100 rounded-xl shadow-sm p-5 font-sans relative transition-all duration-300 hover:border-serene-blue-200 node-slide-in">
            <div className="flex items-center gap-3 mb-4 border-b border-serene-neutral-50 pb-3">
                <div className={`h-8 w-8 rounded-lg ${requiresReview ? 'bg-rose-50' : 'bg-serene-blue-50/50'} flex items-center justify-center ${requiresReview ? 'text-rose-600' : 'text-serene-blue-600'}`}>
                    {requiresReview ? <AlertOctagon className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                </div>
                <div>
                    <h3 className="font-black text-serene-blue-950 text-xs uppercase tracking-wider">Survivor Report</h3>
                    <p className="text-[9px] text-serene-neutral-400 font-bold tracking-[0.15em] uppercase">Vectoral Root</p>
                </div>
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center bg-serene-neutral-50/50 p-2 rounded-lg border border-serene-neutral-100/50">
                    <span className="text-[10px] text-serene-neutral-500 font-black uppercase tracking-tight">Urgency Profile</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${data.urgency === 'high' ? 'bg-sauti-red/10 text-sauti-red' : 'bg-sauti-yellow/10 text-sauti-yellow-dark'}`}>
                        {data.urgency || "Normal"}
                    </span>
                </div>
                <div className="flex justify-between items-center bg-serene-neutral-50/50 p-2 rounded-lg border border-serene-neutral-100/50">
                    <span className="text-[10px] text-serene-neutral-500 font-black uppercase tracking-tight">Primary Incident</span>
                    <div className="flex items-center gap-1.5 text-serene-neutral-900 font-bold text-[10px] capitalize">
                        {getIncidentIcon(data.incident)}
                        <span className="truncate max-w-[100px]">{data.incident?.replace("_", " ")}</span>
                    </div>
                </div>
                {/* Cascade Level Indicator */}
                {cascadeLevel > 0 && (
                    <div className="flex justify-between items-center bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                        <span className="text-[10px] text-amber-600 font-black uppercase tracking-tight flex items-center gap-1">
                            <Layers className="h-3 w-3" /> Cascade
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                            Phase {cascadeLevel}
                        </span>
                    </div>
                )}
                {/* Manual Review Flag */}
                {requiresReview && (
                    <div className="bg-rose-50 p-2 rounded-lg border border-rose-100 text-center">
                        <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest">⚠ Manual Review Required</span>
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Right} className="w-3 h-3 rounded-full border border-white bg-serene-blue-500 shadow-sm" />
        </div>
    );
}

export function StepNode({ data }: { data: any }) {
    return (
        <div className="w-[200px] bg-white border border-serene-neutral-100 rounded-xl shadow-sm p-3 font-sans relative group hover:border-serene-blue-400 transition-all duration-200 node-slide-in">
            <Handle type="target" position={Position.Left} className="w-2 h-2 rounded-full border border-white bg-serene-neutral-300 group-hover:bg-serene-blue-500" />
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-serene-neutral-50 border border-serene-neutral-50 flex items-center justify-center text-serene-neutral-400 group-hover:text-serene-blue-500 group-hover:bg-serene-blue-50">
                    {data.icon === 'filter' ? <Activity className="h-4 w-4" /> : data.icon === 'score' ? <Star className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-black text-serene-neutral-800 text-[10px] uppercase tracking-tight">{data.label}</h4>
                    <p className="text-[9px] text-serene-neutral-400 font-bold truncate leading-tight uppercase opacity-60 tracking-tighter">{data.sublabel}</p>
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="w-2 h-2 rounded-full border border-white bg-serene-neutral-300 group-hover:bg-serene-blue-500" />
        </div>
    );
}

export function ServiceNode({ data }: { data: any }) {
    const isBounced = data.bounced;
    const isMatched = data.matchStatus === "accepted" || data.matchStatus === "scheduled";
    const isFallback = data.isFallback;
    const proColor = data.proColor || { border: "border-serene-neutral-200", bg: "bg-white", text: "text-serene-neutral-600 bg-serene-neutral-50" };
    
    return (
        <div className={`w-[260px] bg-white border ${isBounced ? 'border-red-100' : isFallback ? 'border-amber-200' : 'border-serene-neutral-100'} rounded-xl shadow-sm p-4 font-sans relative transition-all duration-300 hover:border-serene-blue-300 group node-slide-in`}>
            <div className={`absolute -top-3 right-4 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] rounded border border-serene-neutral-50 bg-white shadow-sm ${proColor.text.split(' ')[0]}`}>
                OWNER: {data.proName?.split(' ')[0]}
            </div>

            {/* Fallback Match Badge */}
            {isFallback && !isBounced && (
                <div className="absolute -top-3 left-4 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.15em] rounded border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
                    Fallback
                </div>
            )}

            <Handle type="target" position={Position.Left} className={`w-2.5 h-2.5 rounded-full border border-white ${isBounced ? 'bg-red-400' : 'bg-serene-blue-500'}`} />
            
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${isBounced ? 'bg-red-50 text-red-400' : 'bg-serene-blue-50 text-serene-blue-600'}`}>
                        {data.type === 'unverified' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                        <h4 className={`font-black text-[11px] uppercase tracking-tight truncate max-w-[140px] ${isBounced ? 'text-serene-neutral-400' : 'text-serene-blue-950'}`}>{data.name}</h4>
                        <p className="text-[8px] font-black text-serene-neutral-400 uppercase tracking-widest">{data.serviceTypes?.[0]?.replace("_", " ")}</p>
                    </div>
                </div>

                {!isBounced ? (
                    <div className="bg-serene-neutral-50/50 rounded-lg p-2.5 border border-serene-neutral-100/50 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-serene-neutral-400 uppercase tracking-[0.15em]">Match Score</span>
                            <div className="font-black text-base text-serene-blue-800 leading-none">
                                {data.score} <span className="text-[8px] text-serene-neutral-300">PTS</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {/* Match Quality Label */}
                            <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                data.score >= 60 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                data.score >= 30 ? 'bg-serene-blue-50 text-serene-blue-600 border border-serene-blue-100' :
                                'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                                {data.score >= 60 ? 'Excellent' : data.score >= 30 ? 'Good' : 'Potential'}
                            </span>
                            {isMatched && (
                                 <div className="bg-emerald-50 text-emerald-500 p-1 rounded-md border border-emerald-100">
                                    <CheckCircle2 className="h-3 w-3" />
                                 </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-red-50/50 rounded-lg p-2.5 border border-red-100/50 flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                        <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter truncate">{data.bounceReason}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export function EvaluationLogicNode({ data }: { data: any }) {
    const isBounced = data.bounced;
    const breakdown = data.breakdown;
    
    return (
        <div className="w-[180px] bg-white border border-serene-neutral-100 rounded-xl shadow-sm font-sans relative overflow-hidden group hover:border-serene-blue-400 transition-all duration-200 node-slide-in">
            <Handle type="target" position={Position.Left} className="w-2 h-2 rounded-full border border-white bg-serene-neutral-300 group-hover:bg-serene-blue-500" />
            
            <div className="px-3 py-2 bg-serene-neutral-50/20 border-b border-serene-neutral-50 flex items-center justify-between">
                <h4 className="text-[8px] font-black text-serene-neutral-400 uppercase tracking-widest flex items-center gap-1">
                    <Zap className="w-2 h-2 text-serene-blue-500" /> Scoring
                </h4>
                <div className={`h-1 w-1 rounded-full ${isBounced ? 'bg-red-400' : 'bg-emerald-400'}`} />
            </div>

            <div className="p-2.5 space-y-1.5">
                {/* Stage indicators — show key scoring dimensions */}
                {breakdown ? (
                    <div className="space-y-1">
                        {breakdown.clinical_specialty !== 0 && (
                            <div className="flex items-center justify-between text-[7px]">
                                <span className="text-serene-neutral-400 font-bold uppercase tracking-tighter">Specialty</span>
                                <span className={`font-black ${breakdown.clinical_specialty > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                    {breakdown.clinical_specialty > 0 ? '+' : ''}{breakdown.clinical_specialty}
                                </span>
                            </div>
                        )}
                        {breakdown.proximity !== 0 && (
                            <div className="flex items-center justify-between text-[7px]">
                                <span className="text-serene-neutral-400 font-bold uppercase tracking-tighter">Proximity</span>
                                <span className={`font-black ${breakdown.proximity > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                    {breakdown.proximity > 0 ? '+' : ''}{Math.round(breakdown.proximity)}
                                </span>
                            </div>
                        )}
                        {breakdown.professional_authority > 0 && (
                            <div className="flex items-center justify-between text-[7px]">
                                <span className="text-serene-neutral-400 font-bold uppercase tracking-tighter">Authority</span>
                                <span className="font-black text-emerald-500">+{breakdown.professional_authority}</span>
                            </div>
                        )}
                        {breakdown.load_balancing !== 0 && (
                            <div className="flex items-center justify-between text-[7px]">
                                <span className="text-serene-neutral-400 font-bold uppercase tracking-tighter">Load</span>
                                <span className={`font-black ${breakdown.load_balancing > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {breakdown.load_balancing > 0 ? '+' : ''}{breakdown.load_balancing}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between text-[8px]">
                            <span className="text-serene-neutral-400 font-black uppercase tracking-tighter opacity-70">Efficiency</span>
                            <span className={`font-black ${isBounced ? 'text-red-500' : 'text-emerald-500'}`}>{isBounced ? '0%' : '100%'}</span>
                        </div>
                    </>
                )}
                <div className="flex items-center justify-between text-[8px] pt-1 border-t border-serene-neutral-50 mt-1">
                    <span className="text-serene-neutral-400 font-black uppercase tracking-tighter opacity-70">Total</span>
                    <span className="font-black text-serene-blue-900">{data.score || 0} PTS</span>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="w-2 h-2 rounded-full border border-white bg-serene-neutral-300 group-hover:bg-serene-blue-500" />
        </div>
    );
}

export function ScoringMatrixNode({ data }: { data: any }) {
    const isBounced = data.bounced;
    const isHighlighting = data.isHighlighting;
    const isExiting = data.isExiting;
    const isAccepted = data.matchStatus === 'accepted' || data.matchStatus === 'scheduled';
    const isFallback = data.isFallback;
    const headerColor = isBounced ? 'bg-red-50' : (isAccepted ? 'bg-emerald-50' : isFallback ? 'bg-amber-50' : 'bg-serene-blue-50');
    const borderColor = isBounced ? 'border-red-100' : (isAccepted ? 'border-emerald-100' : isFallback ? 'border-amber-100' : 'border-serene-blue-100');
    const accentColor = isBounced ? 'text-red-500' : (isAccepted ? 'text-emerald-500' : isFallback ? 'text-amber-600' : 'text-serene-blue-600');

    return (
        <div className={`w-[190px] bg-white border ${isHighlighting ? 'border-serene-blue-500 ring-4 ring-serene-blue-50' : borderColor} rounded-2xl font-sans relative overflow-hidden group/matrix transition-all duration-500 ${isHighlighting ? 'animate-pulse scale-105 shadow-xl' : 'shadow-sm'} ${isExiting ? 'node-slide-out' : 'node-slide-in'}`}>
            {/* Mesh Gradient Header */}
            <div className={`${headerColor} px-3 py-3 border-b ${borderColor} flex items-center justify-between relative`}>
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.05)_1px,_transparent_0)] bg-[size:10px_10px]" />
                <h4 className={`font-black ${accentColor} text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 relative z-10`}>
                     {isFallback ? 'Fallback' : 'Scoring'}
                </h4>
                <div className={`font-black ${accentColor} text-[8px]`}>
                    {data.score} PTS
                </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); data.onUnpin?.(); }}
                        className="p-1 text-serene-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all active:scale-90"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
            </div>

            <Handle type="target" position={Position.Left} className={`w-2 h-2 rounded-full border border-white ${accentColor.replace('text-', 'bg-')}`} />

            <div className="p-2 relative bg-white">
                <table className="w-full text-left border-separate border-spacing-0">
                    <tbody className="divide-y divide-serene-neutral-100">
                        {data.reasons?.map((r: string, idx: number) => {
                            const ptsMatch = r.match(/[+\-]?\d+/);
                            const points = ptsMatch ? ptsMatch[0] : '0';
                            const text = r.replace(/\s*\([^)]*\)\s*$/, '').replace(/_/g, " ");

                            return (
                                <tr key={idx} className="group/row">
                                    <td className="py-1.5 text-[8px] font-bold text-serene-neutral-600 capitalize leading-none pr-2">
                                        {text}
                                    </td>
                                    <td className={`py-1.5 text-[8px] font-black ${accentColor} text-right tabular-nums`}>
                                        {points.startsWith('-') ? points : `+${points}`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {isBounced && (
                <div className="m-3 p-2 bg-red-50 rounded-lg border border-red-100 mt-0">
                    <p className="text-[8px] font-black text-red-500 uppercase mb-1 tracking-widest opacity-60 text-center">Termination Criteria Met</p>
                    <p className="text-[9px] font-bold text-red-700 italic text-center px-2 pb-1">
                        "{data.bounceReason}"
                    </p>
                </div>
            )}

            <Handle type="source" position={Position.Right} className={`w-2 h-2 rounded-full border border-white ${accentColor.replace('text-', 'bg-')}`} />
        </div>
    );
}
