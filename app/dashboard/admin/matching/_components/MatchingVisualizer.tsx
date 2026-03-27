"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  MarkerType, 
  Panel, 
  Edge, 
  Node, 
  SelectionMode, 
  ReactFlowProvider, 
  PanOnScrollMode, 
  Position,
  useReactFlow 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { simulateMatch } from '../_actions';
import { CaseNode, StepNode, ServiceNode, EvaluationLogicNode, ScoringMatrixNode } from './CustomNodes';
import { Loader2, Play, X, User, Activity, Star, MapPin, Building2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

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
    const LOGIC_X = 450;
    const PRO_X = 950;
    
    const newNodes = nodes.map((node) => {
        const newNode = { ...node };
        if (node.id === 'case_root') {
            newNode.sourcePosition = Position.Right;
            newNode.targetPosition = Position.Left;
        } else if (node.type === 'logicNode') {
            newNode.sourcePosition = Position.Right;
            newNode.targetPosition = Position.Left;
        }
        return newNode;
    });

    const dagreGraph = new dagre.graphlib.Graph({ compound: true });
    dagreGraph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 150 });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    nodes.forEach(node => {
        if (node.id === 'case_root') {
            dagreGraph.setNode(node.id, { width: 300, height: 250 });
        } else if (node.type === 'logicNode') {
            dagreGraph.setNode(node.id, { width: 220, height: 120 });
        } else if (node.type === 'serviceNode') {
            dagreGraph.setNode(node.id, { width: 280, height: 150 });
        }
    });

    edges.forEach(edge => dagreGraph.setEdge(edge.source, edge.target));
    dagre.layout(dagreGraph);

    const finalNodes = newNodes.map(node => {
        const dNode = dagreGraph.node(node.id);
        if (node.id === 'case_root') {
             node.position = { x: 50, y: dNode.y - dNode.height / 2 };
        } else if (node.type === 'logicNode') {
            node.position = { x: LOGIC_X, y: dNode.y - dNode.height / 2 };
        } else if (node.type === 'serviceNode') {
            node.position = { x: PRO_X, y: dNode.y - dNode.height / 2 };
        }
        return node;
    });

    return { nodes: finalNodes, edges };
};

interface ReportedCase {
    report_id: string;
    type_of_incident: string | null;
    submission_timestamp: string;
    urgency: string | null;
    ismatched: boolean | null;
    record_only: boolean | null;
}

function VisualizerContent({ initialCases }: { initialCases: ReportedCase[] }) {
    const { fitView: flowFitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedCase, setSelectedCase] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [simulatingStep, setSimulatingStep] = useState<number>(0);
    
    const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
    const [hoveredStepData, setHoveredStepData] = useState<any | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout|null>(null);

    const runSimulation = async (reportId: string, isResimulate = false) => {
        setIsLoading(true);
        setSelectedNodeData(null);
        setNodes([]);
        setEdges([]);
        setSimulatingStep(0);
        
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
                    label: 'Survivor Case'
                }
            });

            const uniqueOwnerIds = Array.from(new Set(candidates.map((c: any) => c.cand.user_id)));

            candidates.forEach((cand: any) => {
                const proIndex = uniqueOwnerIds.indexOf(cand.cand.user_id);
                const color = PRO_COLORS[proIndex % PRO_COLORS.length];
                const professionalName = cand.cand.owner_first_name ? `${cand.cand.owner_first_name} ${cand.cand.owner_last_name}` : "Health Prof";

                const serviceNodeId = cand.cand.id;
                const logicNodeId = `logic_${serviceNodeId}`;

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
                
                // Color Logic: Red (Unsuccessful), Blue (Pending), Green (Accepted)
                let edgeColor = isBounced ? '#f87171' : (isAccepted ? '#10b981' : '#3b82f6');
                let edgeWidth = isAccepted || isBounced ? 2.5 : 1.5;

                initialEdges.push({
                    id: `e-case-${logicNodeId}`,
                    source: 'case_root',
                    target: logicNodeId,
                    animated: !isBounced,
                    style: { stroke: (isAccepted || isBounced) ? edgeColor : '#e2e8f0', strokeWidth: edgeWidth },
                });

                initialEdges.push({
                    id: `e-logic-${serviceNodeId}`,
                    source: logicNodeId,
                    target: serviceNodeId,
                    animated: isAccepted,
                    style: { stroke: (isAccepted || isBounced) ? edgeColor : '#cbd5e1', strokeWidth: edgeWidth },
                    markerEnd: { type: MarkerType.ArrowClosed, color: (isAccepted || isBounced) ? edgeColor : '#94a3b8' },
                });
            });

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
            setIsLoading(false);
            
            const delay = 600;
            setNodes(layoutedNodes.filter(n => n.id === 'case_root'));
            setSimulatingStep(1);
            await new Promise(r => setTimeout(r, delay));

            setNodes(prev => [...prev, ...layoutedNodes.filter(n => n.type === 'logicNode')]);
            setEdges(prev => [...prev, ...layoutedEdges.filter(e => e.source === 'case_root')]);
            setSimulatingStep(2);
            await new Promise(r => setTimeout(r, 800));

            setNodes(prev => [...prev, ...layoutedNodes.filter(n => n.type === 'serviceNode')]);
            setEdges(prev => [...prev, ...layoutedEdges.filter(e => e.source.startsWith('logic_'))]);
            setSimulatingStep(3);
            
            setTimeout(() => { flowFitView({ duration: 800, padding: 0.2 }); }, 500);

        } catch (error) {
            console.error("Simulation failed", error);
            setIsLoading(false);
        }
    };

    const onUnpinMatrix = useCallback((logicNodeId: string) => {
        const matrixNodeId = `matrix_${logicNodeId}`;
        const serviceNodeId = logicNodeId.replace('logic_', '');

        setNodes(nds => {
            const matrixNode = nds.find(n => n.id === matrixNodeId);
            if (!matrixNode) return nds;
            const threshold = matrixNode.position.x;
            return nds.filter(n => n.id !== matrixNodeId).map(node => {
                if (node.position.x >= threshold) {
                    return { ...node, position: { ...node.position, x: node.position.x - 200 } };
                }
                return node;
            });
        });

        setEdges(eds => {
            const edsWithoutMatrix = eds.filter(e => e.source !== matrixNodeId && e.target !== matrixNodeId);
            const directEdge = {
                id: `e-${logicNodeId}-${serviceNodeId}`,
                source: logicNodeId,
                target: serviceNodeId,
                animated: true,
                style: { stroke: '#cbd5e1', strokeWidth: 1.5 }
            };
            return [...edsWithoutMatrix, directEdge];
        });
    }, []);

    const onPinMatrix = useCallback((data: any) => {
        const matrixNodeId = `matrix_${data.id || Math.random()}`;
        const serviceNodeId = data.id.replace('logic_', ''); 
        
        setNodes(nds => {
            if (nds.some(n => n.id === matrixNodeId)) return nds;
            const logicNode = nds.find(n => n.id === data.id);
            if (!logicNode) return nds;

            const matrixX = logicNode.position.x + 320;
            const matrixY = logicNode.position.y;

            const newNode: Node = {
                id: matrixNodeId,
                type: 'scoringMatrixNode',
                position: { x: matrixX, y: matrixY },
                data: { ...data, onUnpin: () => onUnpinMatrix(data.id) },
            };

            return nds.map(node => {
                if (node.position.x > logicNode.position.x) {
                    return { ...node, position: { ...node.position, x: node.position.x + 200 } };
                }
                return node;
            }).concat(newNode);
        });

        setEdges(eds => {
            if (eds.some(e => e.source === matrixNodeId)) return eds;
            const newEdges = eds.filter(e => !(e.source === data.id && e.target === serviceNodeId));
            const isAccepted = data.matchStatus === 'ACCEPTED';
            const isBounced = data.bounced;
            const linkColor = isBounced ? '#f87171' : (isAccepted ? '#10b981' : '#3b82f6');
            
            const edge1 = { id: `e-${data.id}-${matrixNodeId}`, source: data.id, target: matrixNodeId, animated: true, style: { stroke: linkColor, strokeWidth: 2 } };
            const edge2 = { id: `e-${matrixNodeId}-${serviceNodeId}`, source: matrixNodeId, target: serviceNodeId, animated: true, style: { stroke: linkColor, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: linkColor } };
            return [...newEdges, edge1, edge2];
        });
        setHoveredStepData(null);
    }, [onUnpinMatrix]);

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
        <div className="flex w-full h-full text-serene-neutral-900 overflow-hidden text-sm antialiased">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                .font-handwriting { font-family: 'Architects Daughter', cursive; }
                .react-flow__node { transform: translateZ(0); backface-visibility: hidden; }
            `}</style>
            
            <div className={`bg-white border-r border-serene-neutral-100 flex flex-col h-full shrink-0 transition-all duration-500 ease-in-out z-10 ${isSidebarCollapsed ? 'w-0 opacity-0 -translate-x-full' : 'w-80 shadow-sm translate-x-0'}`}>
                <div className="p-5 border-b border-serene-neutral-100 bg-white/50 shrink-0 flex items-center justify-between">
                    <h2 className="text-sm font-black text-serene-blue-950 uppercase tracking-widest flex items-center gap-2">Pool <span className="text-[10px] font-bold text-serene-neutral-400 bg-serene-neutral-50 px-2 py-0.5 rounded-md">{initialCases.length}</span></h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-20 custom-scrollbar">
                    {initialCases.map(c => (
                        <div key={c.report_id} onClick={() => { setSelectedCase(c.report_id); runSimulation(c.report_id); }} className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${selectedCase === c.report_id ? 'border-serene-blue-500 bg-serene-blue-50/50 text-serene-blue-950 shadow-sm' : 'border-serene-neutral-50 bg-white hover:border-serene-neutral-200 hover:bg-neutral-50'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${selectedCase === c.report_id ? 'bg-serene-blue-100 text-serene-blue-600' : 'bg-serene-neutral-100 text-serene-neutral-500'}`}>#{c.report_id.slice(0, 8)}</span>
                                <div className={`h-1.5 w-1.5 rounded-full ${c.ismatched ? 'bg-emerald-400' : 'bg-transparent'}`} />
                            </div>
                            <div className={`font-bold text-xs capitalize leading-snug mb-2 line-clamp-2 ${selectedCase === c.report_id ? 'text-serene-blue-900' : 'text-serene-blue-950'}`}>{c.type_of_incident?.replace("_", " ")}</div>
                            <div className={`flex justify-between items-center text-[9px] ${selectedCase === c.report_id ? 'text-serene-blue-500' : 'text-serene-neutral-400'}`}>
                                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {c.urgency}</span>
                                <span>{format(new Date(c.submission_timestamp), 'PP')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 h-full bg-[#FAFAFA] relative overflow-hidden flex flex-col">
                <div className="absolute top-6 left-6 z-50 flex items-center gap-2">
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="bg-white/80 backdrop-blur-md p-3 rounded-xl border border-serene-neutral-100 hover:border-serene-blue-500 shadow-sm text-serene-blue-600 transition-all active:scale-95 group">
                        {isSidebarCollapsed ? <Activity className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </button>
                </div>
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#FAFAFA]/40 backdrop-blur-sm z-50 overflow-hidden">
                        <div className="flex flex-col items-center gap-10 -mt-16">
                             <div className="relative h-24 w-24">
                                 <div className="absolute inset-0 border-[3px] border-serene-blue-50/50 rounded-full" />
                                 <div className="absolute inset-0 border-[3px] border-serene-blue-500 border-t-transparent rounded-full animate-spin" />
                                 <div className="absolute inset-0 flex items-center justify-center"><Activity className="h-8 w-8 text-serene-blue-600 animate-pulse" /></div>
                             </div>
                             <div className="text-center px-8 py-6 bg-white rounded-xl shadow-sm border border-serene-neutral-100 max-w-[280px]">
                                <h3 className="text-lg font-black text-serene-blue-950 tracking-tight leading-none mb-1.5">Vectural Engine</h3>
                                <p className="text-[9px] font-black text-serene-neutral-400 uppercase tracking-widest">Executing Matrix Analysis</p>
                             </div>
                        </div>
                    </div>
                ) : !selectedCase && nodes.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAFAFA] z-40 p-8">
                        <div className="max-w-3xl w-full -mt-44 flex flex-col items-center">
                            <div className="grid grid-cols-3 gap-8 w-full mb-20">
                                {[
                                    { label: 'Platform Load', value: '42%', color: 'border-serene-blue-100 ring-serene-blue-50', doodle: [40, 60, 45, 70, 50, 65] },
                                    { label: 'Match Efficiency', value: '98.2%', color: 'border-emerald-100 ring-emerald-50', doodle: [80, 85, 90, 88, 95, 98] },
                                    { label: 'Latency', value: '14ms', color: 'border-purple-100 ring-purple-50', doodle: [20, 15, 25, 10, 18, 14] }
                                ].map((stat, i) => (
                                    <div key={i} className={`flex flex-col items-start p-8 rounded-xl border-2 bg-white ${stat.color} transition-all relative overflow-hidden group hover:-translate-y-1`}>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-serene-neutral-400 mb-2">{stat.label}</p>
                                        <p className="text-3xl font-black tracking-tight text-serene-blue-950 mb-4">{stat.value}</p>
                                        <div className="w-full h-8 flex items-end gap-1 px-1 opacity-20 group-hover:opacity-40 transition-opacity">
                                            {stat.doodle.map((h, j) => (<div key={j} className={`flex-1 rounded-t-full ${stat.label.includes('Efficiency') ? 'bg-emerald-400' : stat.label.includes('Load') ? 'bg-serene-blue-400' : 'bg-purple-400'}`} style={{ height: `${h}%` }} />))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-center relative">
                                <h2 className="text-4xl font-black text-serene-blue-950 tracking-tight mb-4">Select a Report</h2>
                                <p className="text-serene-neutral-400 max-w-md mx-auto leading-relaxed font-medium">Pick an active incident from the pool to trigger the multi-vector matching simulation and witness algorithmic mapping.</p>
                                <div className="absolute -left-32 top-10 pointer-events-none animate-bounce">
                                    <div className="relative">
                                        <span className="absolute -top-16 -left-4 w-48 text-serene-blue-400 font-handwriting italic text-sm tracking-tight transform rotate-[-15deg]">Initialize the Engine here!</span>
                                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="text-serene-blue-300 -scale-x-100 -rotate-45 opacity-60">
                                            <path d="M10 30L50 30M50 30L35 15M50 30L35 45" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
                
                <ReactFlow
                    nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onNodeMouseEnter={onNodeMouseEnter} onNodeMouseLeave={onNodeMouseLeave} nodeTypes={nodeTypes as any} fitView minZoom={0.05} maxZoom={1.5} zoomOnScroll={false} zoomActivationKeyCode="Control" panOnScroll={true} panOnScrollMode={PanOnScrollMode.Free} selectionMode={SelectionMode.Full} selectNodesOnDrag={true} attributionPosition="bottom-right" className="z-0" style={{ background: '#F8FAFC', touchAction: 'none' }}
                >
                    <Controls className="bg-white/90 backdrop-blur-md shadow-xl border-serene-neutral-200 rounded-xl overflow-hidden p-1" />
                    <Background color="#e2e8f0" gap={20} size={1} />
                    
                    {hoveredStepData && (
                        <div onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }} onMouseLeave={() => { setHoveredStepData(null); }} onClick={() => onPinMatrix(hoveredStepData)} className="bg-white/98 backdrop-blur-2xl p-0 rounded-xl shadow-xl border border-serene-neutral-100/60 w-80 cursor-pointer fixed z-50 animate-in fade-in slide-in-from-left-2 duration-300 overflow-hidden group" style={{ left: hoveredStepData.x, top: hoveredStepData.y, transform: 'translateY(-50%)' }}>
                            <div className="absolute inset-0 bg-serene-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-serene-blue-600 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg transform -rotate-2 uppercase">Pin to canvas</span>
                            </div>
                            <div className="bg-serene-neutral-50 px-5 py-4 border-b border-serene-neutral-100 flex items-center justify-between relative z-10">
                                <h4 className="font-black text-serene-blue-950 text-[10px] uppercase tracking-widest">Scoring Matrix</h4>
                                <div className="text-[10px] font-black text-serene-blue-600 bg-white px-2 py-0.5 rounded border border-serene-blue-100">{hoveredStepData.score} PTS</div>
                            </div>
                            <div className="p-1 relative z-10">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <tbody className="divide-y divide-serene-neutral-50">
                                        {hoveredStepData.reasons?.map((r: string, idx: number) => {
                                            const ptsMatch = r.match(/\+(\d+)/);
                                            const points = ptsMatch ? `+${ptsMatch[1]}` : '0';
                                            const text = r.replace(/\+\d+ pts - /, "").replace(/_/g, " ");
                                            return (<tr key={idx} className="group"><td className="px-4 py-3 text-[10px] font-medium text-serene-neutral-700 capitalize leading-none">{text}</td><td className="px-4 py-3 text-[10px] font-black text-serene-blue-600 text-right tabular-nums">{points}</td></tr>);
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {hoveredStepData.bounceReason && (
                                <div className="m-3 p-3 bg-red-50 rounded-xl border border-red-100 mt-0 text-center">
                                    <p className="text-[8px] font-black text-red-600 uppercase mb-1 tracking-widest">Termination Logic</p>
                                    <p className="text-[9px] font-medium text-red-800 italic leading-snug">"{hoveredStepData.bounceReason}"</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {selectedCase && (
                        <Panel position="top-right" className="flex gap-2">
                            <button onClick={() => runSimulation(selectedCase, true)} className="bg-white border border-serene-blue-100 hover:border-serene-blue-500 text-serene-blue-700 font-bold px-4 py-2 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95"><Play className="w-4 h-4" /> Resimulate Logic</button>
                        </Panel>
                    )}

                    <Panel position="bottom-left" className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-serene-neutral-200 shadow-xl ml-4 mb-4 select-none">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-serene-neutral-400 mb-3 border-b pb-1.5 flex items-center gap-2">Legend</h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#3b82f6] rounded-sm" /><span className="text-[10px] font-bold text-serene-neutral-600">Pending Evaluation</span></div>
                            <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#10b981] rounded-sm" /><span className="text-[10px] font-bold text-serene-neutral-600">Accepted Match</span></div>
                            <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#f87171] rounded-sm" /><span className="text-[10px] font-bold text-serene-neutral-600">Dropped / Ineligible</span></div>
                        </div>
                    </Panel>
                </ReactFlow>

                {selectedNodeData && (
                    <div className="absolute top-0 right-0 h-full w-96 bg-white/95 backdrop-blur-xl shadow-[-10px_0_40px_rgba(0,0,0,0.05)] border-l border-serene-neutral-200/60 z-20 flex flex-col transition-transform duration-300 translate-x-0">
                        <div className="flex items-center justify-between p-5 border-b border-serene-neutral-100">
                            <h3 className="font-bold text-lg text-serene-blue-950 flex items-center gap-2"><Building2 className="w-5 h-5 text-serene-blue-600" /> Profiling Details</h3>
                            <button onClick={() => setSelectedNodeData(null)} className="p-2 bg-serene-neutral-50 hover:bg-serene-neutral-100 rounded-full text-serene-neutral-500 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div><h2 className="text-xl font-black text-serene-neutral-900 mb-1 leading-tight">{selectedNodeData.name || selectedNodeData.label}</h2><p className="text-sm text-serene-neutral-500 capitalize">{selectedNodeData.serviceTypes?.[0]?.replace("_", " ") || "Internal Operation"}</p></div>
                            {selectedNodeData.justification && (<div className="p-5 rounded-xl border border-dashed border-serene-blue-200 bg-serene-blue-50/30"><h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-serene-blue-600">Logic Justification</h4><p className="text-sm font-medium text-serene-neutral-800 leading-relaxed italic">"{selectedNodeData.justification}"</p></div>)}
                            {(selectedNodeData.bounced !== undefined || selectedNodeData.score !== undefined) && (
                                <div className={`p-4 rounded-xl border ${selectedNodeData.bounced ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${selectedNodeData.bounced ? 'text-red-500' : 'text-emerald-500'}`}>Algorithm Conclusion</h4>
                                    {selectedNodeData.bounced ? (<p className="text-sm font-medium text-serene-neutral-800 leading-relaxed">Filtered out due to: <span className="font-bold text-red-600">{selectedNodeData.bounceReason}</span>.</p>) : (<div className="flex items-end justify-between"><p className="text-sm font-medium text-serene-neutral-800">Passed eligibility checks with final priority score.</p><div className="text-3xl font-black text-emerald-600 ml-4 bg-white px-3 py-1 rounded border border-emerald-100 shadow-sm">{selectedNodeData.score}</div></div>)}
                                </div>
                            )}
                            {!selectedNodeData.bounced && selectedNodeData.reasons?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-serene-neutral-400 mb-4 border-b pb-2">Scoring Breakdown</h4>
                                    <ul className="space-y-4">
                                        {selectedNodeData.reasons.map((r: string, idx: number) => {
                                            const ptsMatch = r.match(/\+(\d+)/);
                                            const points = ptsMatch ? `+${ptsMatch[1]}` : null;
                                            const text = r.replace(/\+\d+ pts - /, "");
                                            return (
                                                <li key={idx} className="flex gap-4">
                                                    <div className="mt-1 p-1 bg-serene-blue-50 text-serene-blue-500 rounded shrink-0 flex items-center justify-center h-6 w-6"><Star className="w-3.5 h-3.5" /></div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm text-serene-neutral-800 flex items-center justify-between">
                                                            <span className="capitalize">{text.replace(/_/g, " ")}</span>
                                                            {points && <span className="text-[10px] px-2 py-0.5 rounded bg-serene-blue-600 text-white font-black">{points}</span>}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
