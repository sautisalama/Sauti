"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  ControlButton,
  Controls,
  Background,
  Panel,
  useReactFlow,
  MarkerType,
  Node,
  Edge,
  PanOnScrollMode,
  SelectionMode,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { simulateMatch } from '../_actions';
import { CaseNode, StepNode, ServiceNode, EvaluationLogicNode, ScoringMatrixNode } from './CustomNodes';
import { ShieldAlert, Activity, Play, X, Building2, Star, Target, Info, ArrowRight, Zap } from 'lucide-react';
import { format } from 'date-fns';
import Lottie from "lottie-react";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

import sandsOfTime from "@/public/lottie-animations/sands-of-time.json";
import loadingHands from "@/public/lottie-animations/loading-hands.json";
import errorRobot from "@/public/lottie-animations/Error-404-broken-robot.json";

const nodeTypes = {
  caseNode: CaseNode,
  stepNode: StepNode,
  serviceNode: ServiceNode,
  logicNode: EvaluationLogicNode,
  scoringMatrixNode: ScoringMatrixNode,
};

const PRO_COLORS = [
    { border: "border-blue-400/30", bg: "bg-blue-50/40", text: "text-blue-700 bg-blue-100/80" },
    { border: "border-purple-400/30", bg: "bg-purple-50/40", text: "text-purple-700 bg-purple-100/80" },
    { border: "border-emerald-400/30", bg: "bg-emerald-50/40", text: "text-emerald-700 bg-emerald-100/80" },
    { border: "border-amber-400/30", bg: "bg-amber-50/40", text: "text-amber-700 bg-amber-100/80" },
    { border: "border-rose-400/30", bg: "bg-rose-50/40", text: "text-rose-700 bg-rose-100/80" },
];

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 260, marginx: 100, marginy: 100 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach(node => {
        // Use actual dimensions from CustomNodes.tsx
        let width = 180;
        let height = 100;

        if (node.id === 'case_root') {
            width = 288;
            height = 140;
        } else if (node.type === 'serviceNode') {
            width = 260;
            height = 160;
        } else if (node.type === 'scoringMatrixNode') {
            width = 180;
            height = 200;
        }

        g.setNode(node.id, { width, height });
    });

    edges.forEach(edge => g.setEdge(edge.source, edge.target));
    dagre.layout(g);

    return {
        nodes: nodes.map(node => {
            const { x, y, width, height } = g.node(node.id);
            return {
                ...node,
                position: { x: x - width / 2, y: y - height / 2 },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            };
        }),
        edges
    };
};


interface ReportedCase {
    report_id: string;
    type_of_incident: string | null;
    submission_timestamp: string;
    urgency: string | null;
    ismatched: boolean | null;
    record_only: boolean | null;
    first_name?: string;
    last_name?: string;
}


function VisualizerContent({ initialCases }: { initialCases: ReportedCase[] }) {
    const dash = useDashboardData();
    const { fitView: flowFitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedCase, setSelectedCase] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [simulatingStep, setSimulatingStep] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
    const [hoveredStepData, setHoveredStepData] = useState<any | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout|null>(null);
    const cases = initialCases || [];

    const runSimulation = async (reportId: string, isResimulate = false) => {
        setIsLoading(true);
        setSelectedNodeData(null);
        setNodes([]);
        setEdges([]);
        setSimulatingStep(0);
        setError(null);
        
        // Auto-collapse navigation sidebar for more space
        if (dash?.setIsSidebarCollapsed) {
            dash.setIsSidebarCollapsed(true);
        }

        try {
            const data = await simulateMatch(reportId);
            const { report, candidates } = data;

            const initialNodes: Node[] = [];
            const initialEdges: Edge[] = [];

            initialNodes.push({
                id: 'case_root',
                type: 'caseNode',
                position: { x: 0, y: 0 },
                data: {
                    urgency: report.urgency,
                    incident: report.type_of_incident,
                    requiredServices: report.required_services,
                    label: report.label || 'Survivor Report',
                    subHeader: 'Report Origin'
                }
            });

            const uniqueOwnerIds = Array.from(new Set(candidates.map((c: any) => c.cand.user_id)));

            candidates.forEach((cand: any) => {
                const proIndex = uniqueOwnerIds.indexOf(cand.cand.user_id);
                const color = PRO_COLORS[proIndex % PRO_COLORS.length];
                const professionalName = cand.cand.owner_first_name ? `${cand.cand.owner_first_name} ${cand.cand.owner_last_name}` : "Professional";
                const logicNodeId = `logic_${cand.cand.id}`;
                const serviceNodeId = cand.cand.id;
                const matrixNodeId = `matrix_${logicNodeId}`;

                initialNodes.push({
                    id: logicNodeId,
                    type: 'logicNode',
                    position: { x: 0, y: 0 },
                    data: { ...cand.cand, ...cand, proColor: color, proName: professionalName }
                });

                initialNodes.push({
                    id: serviceNodeId,
                    type: 'serviceNode',
                    position: { x: 0, y: 0 },
                    data: { ...cand.cand, ...cand, proColor: color, proName: professionalName }
                });

                const isAccepted = cand.matchStatus === "accepted" || cand.matchStatus === "scheduled";
                const isBounced = cand.bounced;

                let edgeColor = isBounced ? '#f87171' : (isAccepted ? '#10b981' : '#3b82f6');
                let edgeWidth = isAccepted || isBounced ? 4 : 2.5; // Thicker lines

                initialEdges.push({
                    id: `e-case-${logicNodeId}`,
                    source: 'case_root',
                    target: logicNodeId,
                    animated: !isBounced,
                    style: { stroke: (isAccepted || isBounced) ? edgeColor : '#e2e8f0', strokeWidth: edgeWidth, strokeDasharray: isAccepted || isBounced ? '0' : '5 5' },
                });

                initialEdges.push({
                    id: `e-logic-${serviceNodeId}`,
                    source: logicNodeId,
                    target: serviceNodeId,
                    animated: isAccepted,
                    style: { stroke: (isAccepted || isBounced) ? edgeColor : '#cbd5e1', strokeWidth: edgeWidth, strokeDasharray: isAccepted || isBounced ? '0' : '5 5' },
                    markerEnd: { type: MarkerType.ArrowClosed, color: (isAccepted || isBounced) ? edgeColor : '#94a3b8' },
                });
            });

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
            setIsLoading(false);

            const caseNode = layoutedNodes.find(n => n.type === 'caseNode');
            const logicNodes = layoutedNodes.filter(n => n.type === 'logicNode');
            const serviceNodes = layoutedNodes.filter(n => n.type === 'serviceNode');

            // Preservation: Keep existing pinned matrix cards
            const pinnedNodes = nodes.filter(n => n.type === 'scoringMatrixNode'); 

            // Initialize with the case root and any already pinned items
            setNodes(caseNode ? [caseNode, ...pinnedNodes] : pinnedNodes);
            setEdges([]);

            // Sequential Discovery Reveal (Gamification)
            logicNodes.forEach((node, idx) => {
                setTimeout(() => {
                    setNodes(nds => {
                        if (nds.find(n => n.id === node.id)) return nds;
                        return [...nds, node];
                    });
                    const edgeFromCase = layoutedEdges.find(e => e.target === node.id);
                    if (edgeFromCase) {
                        setEdges(eds => [...eds, { ...edgeFromCase, animated: true }]);
                    }
                }, 400 + (idx * 350));
            });

            // Final reveal of service connections
            setTimeout(() => {
                setNodes(nds => {
                    const newIds = new Set(nds.map(n => n.id));
                    const toAdd = serviceNodes.filter(sn => !newIds.has(sn.id));
                    return [...nds, ...toAdd];
                });
                
                const sEdges = layoutedEdges.filter(e => serviceNodes.some(sn => sn.id === e.target));
                setEdges(eds => {
                    const existingIds = new Set(eds.map(e => e.id));
                    const newEdges = sEdges.filter(e => !existingIds.has(e.id)).map(e => ({ ...e, animated: true }));
                    return [...eds, ...newEdges];
                });

                // Restore edges for pinned items
                const pinnedEdges = edges.filter(e => e.id.includes('matrix'));
                if (pinnedEdges.length > 0) {
                    setEdges(eds => {
                        const existingIds = new Set(eds.map(e => e.id));
                        const toRestore = pinnedEdges.filter(pe => !existingIds.has(pe.id));
                        return [...eds, ...toRestore];
                    });
                }
            }, 600 + (logicNodes.length * 350));

            setSimulatingStep(3);

            setTimeout(() => {
                flowFitView({ duration: 1000, padding: 0.15 });
            }, 100);

        } catch (error: any) {
            console.error("Simulation failed", error);
            setError(error.message || "An unexpected error occurred in the matching engine.");
            setIsLoading(false);
        }
    };

    const onUnpinMatrix = useCallback((logicNodeId: string) => {
        const matrixNodeId = `matrix_${logicNodeId}`;
        const serviceNodeId = logicNodeId.replace('logic_', '');

        // 1. Trigger exit animation
        setNodes(nds => nds.map(n => {
            if (n.id === matrixNodeId) return { ...n, data: { ...n.data, isExiting: true } };
            return n;
        }));

        // 2. Clear after animation
        setTimeout(() => {
            setNodes(nds => nds.filter(n => n.id !== matrixNodeId));
            setEdges(eds => {
                const filtered = eds.filter(e => e.source !== matrixNodeId && e.target !== matrixNodeId);
                const hasDirect = filtered.some(e => e.source === logicNodeId && e.target === serviceNodeId);
                if (!hasDirect) {
                    return [...filtered, { 
                        id: `e-${logicNodeId}-${serviceNodeId}`, 
                        source: logicNodeId, 
                        target: serviceNodeId, 
                        animated: true, 
                        type: 'smoothstep', 
                        style: { stroke: '#cbd5e1', strokeWidth: 1.5, opacity: 0.6 } 
                    }];
                }
                return filtered;
            });
        }, 400);

        setHoveredStepData(null);
    }, []);

    const onPinMatrix = useCallback((data: any) => {
        const matrixNodeId = `matrix_${data.id || Math.random()}`;
        const serviceNodeId = data.id.replace('logic_', ''); 
        
        setNodes(nds => {
            if (nds.some(n => n.id === matrixNodeId)) return nds;
            const logicNode = nds.find(n => n.id === data.id);
            if (!logicNode) return nds;

            // Target position: horizontally next to the parent card
            const targetX = logicNode.position.x + 220; 
            const targetY = logicNode.position.y; 

            // Symmetrical Push: Shift nodes BOTH ways to avoid erratic placements
            const shiftedNodes = nds.map(n => {
                const isInMatrixColumn = n.position.x > targetX - 60 && n.position.x < targetX + 60;
                const isCloseVertically = Math.abs(n.position.y - targetY) < 180;
                
                if (isInMatrixColumn && isCloseVertically && n.id !== logicNode.id) {
                    const shiftY = n.position.y < targetY ? -180 : 180;
                    return { ...n, position: { ...n.position, y: n.position.y + shiftY } };
                }
                return n;
            });

            const newNode: Node = {
                id: matrixNodeId,
                type: 'scoringMatrixNode',
                position: { x: targetX, y: targetY },
                data: { ...data, onUnpin: () => onUnpinMatrix(data.id) },
            };

            const finalNodes = [...shiftedNodes, newNode];

            // Save new arrangement immediately for persistence
            if (selectedCase) {
                const key = `ss_matching_positions_${selectedCase}`;
                const positions = finalNodes.reduce((acc: any, n) => {
                    acc[n.id] = n.position;
                    return acc;
                }, {});
                localStorage.setItem(key, JSON.stringify(positions));
            }

            return finalNodes;
        });

        setEdges(eds => {
            if (eds.some(e => e.source === matrixNodeId)) return eds;
            const newEdges = eds.filter(e => !(e.source === data.id && e.target === serviceNodeId));
            const isAccepted = data.matchStatus === 'accepted' || data.matchStatus === 'scheduled';
            const isBounced = data.bounced;
            const linkColor = isBounced ? '#f87171' : (isAccepted ? '#10b981' : '#3b82f6');
            
            const edge1 = { id: `e-${data.id}-${matrixNodeId}`, source: data.id, target: matrixNodeId, animated: true, type: 'straight', style: { stroke: linkColor, strokeWidth: 3, strokeDasharray: '5 5' } };
            const edge2 = { id: `e-${matrixNodeId}-${serviceNodeId}`, source: matrixNodeId, target: serviceNodeId, animated: true, type: 'smoothstep', style: { stroke: linkColor, strokeWidth: 3, strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed, color: linkColor } };
            return [...newEdges, edge1, edge2];
        });
        setHoveredStepData(null);
    }, [onUnpinMatrix, selectedCase]);

    
    const onNodeDragStop = useCallback((_: any, node: any) => {
        if (!selectedCase) return;
        const key = `ss_matching_positions_${selectedCase}`;
        const saved = localStorage.getItem(key);
        const positions = saved ? JSON.parse(saved) : {};
        positions[node.id] = node.position;
        localStorage.setItem(key, JSON.stringify(positions));
    }, [selectedCase]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (['serviceNode', 'logicNode', 'scoringMatrixNode'].includes(node.type || '')) {
            setSelectedNodeData(node.data);
        } else {
            setSelectedNodeData(null);
        }
    }, []);

    const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
        if (node.type === 'logicNode') {
            const matrixNodeId = `matrix_${node.id}`;
            if (nodes.some(n => n.id === matrixNodeId)) {
                setNodes(nds => nds.map(n => n.id === matrixNodeId ? { ...n, data: { ...n.data, isHighlighting: true } } : n));
                setTimeout(() => { setNodes(nds => nds.map(n => n.id === matrixNodeId ? { ...n, data: { ...n.data, isHighlighting: false } } : n)); }, 1000);
                return;
            }
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            const rect = event.currentTarget.getBoundingClientRect();
            setHoveredStepData({ ...node.data, id: node.id, x: rect.right + 10, y: rect.top + rect.height / 2 });
        }
    }, [nodes]);

    const onNodeMouseLeave = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type === 'logicNode') {
            hoverTimeoutRef.current = setTimeout(() => { setHoveredStepData(null); }, 300);
        }
    }, []);

    return (
        <div className="flex w-full h-full relative text-serene-neutral-900 overflow-hidden text-sm antialiased">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                .font-handwriting { font-family: 'Architects Daughter', cursive; }
                .react-flow__node { transform: translateZ(0); backface-visibility: hidden; transition: box-shadow 0.3s ease; }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
                @keyframes slideOut {
                    from { opacity: 1; transform: scale(1); }
                    to { opacity: 0; transform: scale(0.9); }
                }
                .node-slide-in { animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .node-slide-out { animation: slideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>

            <div className={`absolute left-0 top-0 bottom-0 bg-white border-r border-serene-neutral-100 flex flex-col h-full shrink-0 transition-transform duration-500 ease-in-out z-[60] w-80 ${isSidebarCollapsed ? '-translate-x-full shadow-none' : 'translate-x-0 shadow-2xl'}`}>
                <div className="p-5 border-b border-serene-neutral-100 bg-white/50 shrink-0 flex items-center justify-between">
                    <h2 className="text-sm font-black text-serene-blue-950 uppercase tracking-[0.2em] flex items-center gap-2">Case Pool <span className="text-[10px] font-bold text-serene-neutral-400 bg-serene-neutral-50 px-2 py-0.5 rounded-md">{(cases).length}</span></h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20 custom-scrollbar">
                    {cases.length > 0 ? cases.map(c => (
                        <div key={c.report_id} onClick={() => { setSelectedCase(c.report_id); runSimulation(c.report_id); }} className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer group ${selectedCase === c.report_id ? 'border-serene-blue-500 bg-serene-blue-50/40 shadow-sm ring-1 ring-serene-blue-100' : 'border-serene-neutral-50 bg-white hover:border-serene-neutral-200 hover:bg-serene-neutral-50 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${selectedCase === c.report_id ? 'bg-serene-blue-600 text-white' : 'bg-serene-neutral-100 text-serene-neutral-500'}`}>#{c.report_id.slice(0, 8)}</span>
                                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                    c.urgency === 'high' ? 'bg-rose-50 text-rose-500 border border-rose-100' :
                                    c.urgency === 'medium' ? 'bg-amber-50 text-amber-500 border border-amber-100' :
                                    'bg-emerald-50 text-emerald-500 border border-emerald-100'
                                }`}>
                                    {c.urgency || 'Normal'}
                                </div>
                            </div>
                            <div className={`font-black text-[14px] tracking-tight leading-tight mb-1 uppercase ${selectedCase === c.report_id ? 'text-serene-blue-950' : 'text-serene-neutral-900'}`}>Case #{c.report_id.slice(0, 8)}</div>
                            <div className={`text-[11px] font-medium capitalize mb-3 line-clamp-1 ${selectedCase === c.report_id ? 'text-serene-blue-600' : 'text-serene-neutral-500'}`}>{c.type_of_incident ? c.type_of_incident.replace(/_/g, " ") : "Unknown"}</div>
                            <div className={`flex justify-between items-center text-[9px] ${selectedCase === c.report_id ? 'text-serene-blue-600' : 'text-serene-neutral-400'}`}>
                                <span className="flex items-center gap-1.5 font-bold"><Activity className="w-3 h-3 opacity-50" /> {c.ismatched ? 'Matched' : 'Unmatched'}</span>
                                <span className="font-medium opacity-60 uppercase">{c.submission_timestamp ? format(new Date(c.submission_timestamp), 'PP') : "No Date"}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center opacity-60 bg-serene-neutral-50/50 rounded-3xl border-2 border-dashed border-serene-neutral-100 m-3">
                            <ShieldAlert className="w-10 h-10 mb-4 text-serene-neutral-300" />
                            <p className="text-[10px] font-black text-serene-neutral-400 uppercase tracking-widest leading-loose">No active incident reports discovered in the database pool</p>
                        </div>
                    )}

                </div>
            </div>

            <div className="flex-1 h-full w-full bg-[#FAFAFA] relative overflow-hidden flex flex-col">
                <div className={`absolute top-6 z-[70] flex items-center gap-2 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'left-6' : 'left-[344px]'}`}>
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="bg-white/80 backdrop-blur-md p-3 rounded-xl border border-serene-neutral-100 hover:border-serene-blue-500 shadow-sm text-serene-blue-600 transition-all active:scale-95 group">
                        {isSidebarCollapsed ? <Activity className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </button>
                </div>
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#FAFAFA]/80 backdrop-blur-md z-[80]">
                        <div className="flex flex-col items-center gap-6 text-center">
                             <div className="h-64 w-64">
                                <Lottie animationData={simulatingStep > 0 ? loadingHands : sandsOfTime} loop={true} />
                             </div>
                             <div className="bg-white px-10 py-8 rounded-[40px] border border-serene-neutral-100 max-w-[320px] animate-in zoom-in duration-500">
                                <h3 className="text-2xl font-black text-serene-blue-950 tracking-tighter leading-none mb-2 uppercase">Engine Processing</h3>
                                <p className="text-[10px] font-black text-serene-blue-500 uppercase tracking-[0.3em] mt-3 animate-pulse">Mapping Matrix Vectors...</p>
                             </div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#FAFAFA] z-[90]">
                        <div className="flex flex-col items-center gap-8 max-w-md text-center p-12">
                            <div className="h-72 w-72">
                                <Lottie animationData={errorRobot} loop={true} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-serene-blue-950 tracking-tight mb-4 uppercase">System Anomaly</h2>
                                <p className="text-serene-neutral-500 font-semibold leading-relaxed mb-8">{error}</p>
                                <button onClick={() => setError(null)} className="bg-serene-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-serene-blue-700 transition-all active:scale-95">Reset Engine</button>
                            </div>
                        </div>
                    </div>
                ) : !selectedCase && nodes.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAFAFA] z-10 p-8">
                        <div className="max-w-3xl w-full flex flex-col items-center">
                            <div className="grid grid-cols-3 gap-8 w-full mb-20 animate-in fade-in slide-in-from-bottom-5 duration-1000">
                                {[
                                    { label: 'Platform Load', value: '42%', color: 'border-serene-blue-100 ring-serene-blue-50', doodle: [40, 60, 45, 70, 50, 65] },
                                    { label: 'Match Efficiency', value: '98.2%', color: 'border-emerald-100 ring-emerald-50', doodle: [80, 85, 90, 88, 95, 98] },
                                    { label: 'Latency', value: '14ms', color: 'border-purple-100 ring-purple-50', doodle: [20, 15, 25, 10, 18, 14] }
                                ].map((stat, i) => (
                                    <div key={i} className={`flex flex-col items-start p-8 rounded-2xl border-2 bg-white ${stat.color} transition-all relative overflow-hidden group hover:-translate-y-2 hover:shadow-xl`}>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-serene-neutral-400 mb-2">{stat.label}</p>
                                        <p className="text-3xl font-black tracking-tight text-serene-blue-950 mb-4">{stat.value}</p>
                                        <div className="w-full h-8 flex items-end gap-1 px-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                            {stat.doodle.map((h, j) => (<div key={j} className={`flex-1 rounded-t-full ${stat.label.includes('Efficiency') ? 'bg-emerald-400' : stat.label.includes('Load') ? 'bg-serene-blue-400' : 'bg-purple-400'}`} style={{ height: `${h}%` }} />))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-center relative">
                                <h2 className="text-5xl font-black text-serene-blue-950 tracking-tight mb-6">Select a Report</h2>
                                <p className="text-serene-neutral-400 max-w-lg mx-auto leading-relaxed font-semibold text-lg">Pick an active incident from the pool to trigger the multi-vector matching simulation and witness algorithmic mapping.</p>
                                <div className="absolute -left-40 top-10 pointer-events-none">
                                    <div className="relative animate-bounce duration-[2000ms]">
                                        <span className="absolute -top-20 -left-6 w-56 text-serene-blue-400 font-handwriting italic text-lg tracking-tight transform rotate-[-12deg]">Initialize the Engine here!</span>
                                        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-serene-blue-300 -scale-x-100 -rotate-45 opacity-60">
                                            <path d="M10 40L70 40M70 40L50 20M70 40L50 60" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
                
                <ReactFlow
                    nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
                    onNodeClick={onNodeClick} onNodeMouseEnter={onNodeMouseEnter} onNodeMouseLeave={onNodeMouseLeave} 
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes as any} fitView minZoom={0.05} maxZoom={1.5} zoomOnScroll={false} 
                    zoomActivationKeyCode="Control" panOnScroll={true} panOnScrollMode={PanOnScrollMode.Free} 
                    selectionMode={SelectionMode.Full} selectNodesOnDrag={true} attributionPosition="bottom-right" 
                    className="z-0" style={{ background: '#F8FAFC', touchAction: 'none' }}
                >
                    <Controls className="bg-white/90 backdrop-blur-md shadow-2xl border-serene-neutral-200 rounded-2xl overflow-hidden p-1" />
                    <Background color="#e2e8f0" gap={20} size={1} />
                    
                    {hoveredStepData && (
                        <div onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }} onMouseLeave={() => { setHoveredStepData(null); }} onClick={() => onPinMatrix(hoveredStepData)} className="bg-white/98 backdrop-blur-2xl p-0 rounded-[20px] shadow-2xl border border-serene-neutral-100/60 w-[190px] cursor-pointer fixed z-[100] animate-in fade-in slide-in-from-right-2 duration-300 overflow-hidden group hover:scale-[1.05] transition-transform" style={{ left: hoveredStepData.x, top: hoveredStepData.y, transform: 'translateY(-50%)' }}>
                            <div className="absolute inset-0 bg-serene-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2.5px] z-20">
                                <div className="bg-serene-blue-600 text-white px-2 py-3 rounded-full text-[8px] font-black shadow-2xl transform -rotate-1 uppercase tracking-[0.2em] flex items-center gap-1 border-2 border-white/20 whitespace-nowrap">
                                   <Zap className="w-3 h-3 fill-current" /> Snap to Canvas
                                </div>
                            </div>

                            <div className={`${hoveredStepData.bounced ? 'bg-red-50' : (hoveredStepData.matchStatus === 'accepted' || hoveredStepData.matchStatus === 'scheduled' ? 'bg-emerald-50' : 'bg-serene-blue-50')} px-3 py-3 border-b border-serene-neutral-100 flex items-center justify-between relative z-10 overflow-hidden`}>
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,_theme(colors.gray.400)_1px,_transparent_0)] bg-[size:10px_10px]" />
                                <h4 className={`font-black ${hoveredStepData.bounced ? 'text-red-500' : (hoveredStepData.matchStatus === 'accepted' || hoveredStepData.matchStatus === 'scheduled' ? 'text-emerald-500' : 'text-serene-blue-600')} text-[10px] uppercase tracking-[0.2em] relative z-10`}>Evaluation</h4>
                                <div className="text-[8px] font-black text-serene-blue-600 bg-white px-1.5 py-0.5 rounded-lg border border-serene-blue-100 shadow-sm relative z-10">{hoveredStepData.score} PTS</div>
                            </div>
                            <div className="p-2 relative z-10 bg-white">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <tbody className="divide-y divide-serene-neutral-50">
                                        {hoveredStepData.reasons?.map((r: string, idx: number) => {
                                            const ptsMatch = r.match(/\+(\d+)/);
                                            const points = ptsMatch ? `+${ptsMatch[1]}` : '0';
                                            const text = r.replace(/\+\d+ pts - /, "").replace(/_/g, " ");
                                            return (<tr key={idx} className="group/row"><td className="py-1.5 text-[8px] font-bold text-serene-neutral-600 pr-2 capitalize leading-none">{text}</td><td className={`py-1.5 text-[8px] font-black ${hoveredStepData.bounced ? 'text-red-500' : (hoveredStepData.matchStatus === 'accepted' || hoveredStepData.matchStatus === 'scheduled' ? 'text-emerald-500' : 'text-serene-blue-600')} text-right tabular-nums`}>{points}</td></tr>);
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {hoveredStepData.bounceReason && (
                                <div className="m-3 p-2 bg-red-50 rounded-lg border border-red-100 mt-0 text-center">
                                    <p className="text-[8px] font-black text-red-500 uppercase mb-1 tracking-widest opacity-60">Termination Criteria</p>
                                    <p className="text-[9px] font-bold text-red-700 italic px-2 pb-1">"{hoveredStepData.bounceReason}"</p>
                                </div>
                            )}

                        </div>
                    )}
                    
                    {selectedCase && (
                        <Panel position="top-right" className="flex gap-2">
                            <button onClick={() => runSimulation(selectedCase, true)} className="bg-white border-2 border-serene-neutral-100 hover:border-serene-blue-500 text-serene-blue-700 font-black px-6 py-3 rounded-2xl shadow-xl transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest text-[10px]"><Play className="w-4 h-4 fill-current" /> Initialize Engine</button>
                        </Panel>
                    )}

                    <Panel position="bottom-left" className={`bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-serene-neutral-200 shadow-2xl mb-6 select-none max-w-xs transition-all duration-500 ${isSidebarCollapsed ? 'ml-6' : 'ml-[344px]'}`}>
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-serene-neutral-500 mb-4 border-b border-serene-neutral-100 pb-2 flex items-center gap-2">Network Protocol</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-4"><div className="w-4 h-1 bg-serene-blue-500 rounded-full" /><span className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest">Active Evaluation</span></div>
                            <div className="flex items-center gap-4"><div className="w-4 h-1 bg-emerald-500 rounded-full" /><span className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest">Connected Match</span></div>
                            <div className="flex items-center gap-4"><div className="w-4 h-1 bg-rose-400 rounded-full" /><span className="text-[11px] font-black text-serene-neutral-600 uppercase tracking-widest">Bounced Logic</span></div>
                        </div>
                    </Panel>
                </ReactFlow>

                {/* Evaluation profile sidepanel removed as per user request */}
            </div>
        </div>
    );
}


export default function MatchingVisualizer(props: { initialCases: ReportedCase[] }) {
    return (
        <ReactFlowProvider>
            <VisualizerContent {...props} />
        </ReactFlowProvider>
    );
}
