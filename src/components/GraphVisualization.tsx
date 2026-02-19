import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, FraudRing, AggregatedEdge } from '@/lib/types';

const RING_COLORS = ['#ff6b6b', '#ffa36b', '#ffd93d', '#6bff6b', '#6bdfff', '#a36bff', '#ff6bdf', '#ff9e9e', '#9effce', '#9eceff'];

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimLink = AggregatedEdge & d3.SimulationLinkDatum<SimNode>;

interface Props {
  data: GraphData;
  rings: FraudRing[];
  selectedRingId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

const GraphVisualization = ({ data, rings, selectedRingId, onNodeSelect }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  const ringColorMap = useCallback(() => {
    const map = new Map<string, string>();
    rings.forEach((r, i) => map.set(r.ring_id, RING_COLORS[i % RING_COLORS.length]));
    return map;
  }, [rings]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 500;
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Aggregate edges
    const edgeMap = new Map<string, AggregatedEdge>();
    for (const e of data.edges) {
      const key = `${e.source}->${e.target}`;
      const existing = edgeMap.get(key);
      if (existing) { existing.totalAmount += e.amount; existing.count++; }
      else edgeMap.set(key, { source: e.source, target: e.target, totalAmount: e.amount, count: 1 });
    }
    const aggEdges = [...edgeMap.values()];

    const simNodes: SimNode[] = data.nodes.map(n => ({ ...n }));
    const simLinks: SimLink[] = aggEdges.map(e => ({ ...e }));

    const rColors = ringColorMap();

    // Defs
    const defs = svg.append('defs');
    defs.append('marker').attr('id', 'arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#4a5568');
    defs.append('marker').attr('id', 'arrow-highlight').attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#38bdf8');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filter.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).join('feMergeNode').attr('in', d => d);

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 5])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Simulation
    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Links
    const link = g.append('g').selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks).join('line')
      .attr('stroke', '#2d3748').attr('stroke-opacity', 0.5)
      .attr('stroke-width', d => Math.min(4, 0.5 + Math.log(d.count + 1)))
      .attr('marker-end', 'url(#arrow)');

    // Node groups
    const nodeG = g.append('g').selectAll<SVGGElement, SimNode>('g')
      .data(simNodes).join('g').attr('cursor', 'pointer');

    // Outer ring for suspicious
    nodeG.filter(d => d.suspicious).append('circle')
      .attr('r', d => (d.suspicious ? 14 : 10) + 4)
      .attr('fill', 'none')
      .attr('stroke', d => {
        if (d.ring_ids.length > 0) return rColors.get(d.ring_ids[0]) || '#ff6b6b';
        return '#ff6b6b';
      })
      .attr('stroke-width', 2).attr('stroke-dasharray', '3,2').attr('opacity', 0.7);

    // Main circle
    nodeG.append('circle')
      .attr('r', d => d.suspicious ? 10 : 6)
      .attr('fill', d => {
        if (d.suspicious) {
          const t = d.suspicion_score / 100;
          return d3.interpolateRgb('#ffa36b', '#ff3b3b')(t);
        }
        return '#38bdf8';
      })
      .attr('stroke', d => d.suspicious ? '#ff6b6b' : '#1e3a5f')
      .attr('stroke-width', d => d.suspicious ? 2 : 1)
      .attr('filter', d => d.suspicious ? 'url(#glow)' : null);

    // Labels for suspicious
    nodeG.filter(d => d.suspicious).append('text')
      .attr('dy', -16).attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0').attr('font-size', '9px').attr('font-family', 'monospace')
      .text(d => d.id.length > 12 ? d.id.slice(0, 12) + '…' : d.id);

    // Drag
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });
    nodeG.call(drag);

    // Hover
    nodeG.on('mouseenter', (event, d) => {
      const [x, y] = d3.pointer(event, containerRef.current);
      setTooltip({ x, y, node: d });
    }).on('mouseleave', () => setTooltip(null))
      .on('click', (_, d) => onNodeSelect(d.id));

    // Tick
    simulation.on('tick', () => {
      link.attr('x1', d => (d.source as SimNode).x!).attr('y1', d => (d.source as SimNode).y!)
        .attr('x2', d => (d.target as SimNode).x!).attr('y2', d => (d.target as SimNode).y!);
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Highlight selected ring
    if (selectedRingId) {
      const ring = rings.find(r => r.ring_id === selectedRingId);
      if (ring) {
        const members = new Set(ring.member_accounts);
        nodeG.selectAll<SVGCircleElement, SimNode>('circle').attr('opacity', d => members.has(d.id) ? 1 : 0.15);
        link.attr('opacity', d => {
          const src = typeof d.source === 'string' ? d.source : (d.source as SimNode).id;
          const tgt = typeof d.target === 'string' ? d.target : (d.target as SimNode).id;
          return members.has(src) && members.has(tgt) ? 1 : 0.05;
        });
      }
    }

    return () => { simulation.stop(); };
  }, [data, rings, selectedRingId, ringColorMap, onNodeSelect]);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(2);

  return (
    <div ref={containerRef} className="relative w-full h-[550px] bg-card rounded-xl border border-border overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
      {tooltip && (
        <div
          className="absolute z-50 bg-popover border border-border rounded-lg p-3 shadow-xl pointer-events-none text-xs space-y-1 min-w-[200px]"
          style={{ left: Math.min(tooltip.x + 15, (containerRef.current?.clientWidth || 400) - 220), top: tooltip.y - 10 }}
        >
          <p className="font-mono font-bold text-foreground">{tooltip.node.id}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
            <span>In-degree:</span><span className="text-foreground">{tooltip.node.in_degree}</span>
            <span>Out-degree:</span><span className="text-foreground">{tooltip.node.out_degree}</span>
            <span>Amount In:</span><span className="text-foreground">{fmt(tooltip.node.total_amount_in)}</span>
            <span>Amount Out:</span><span className="text-foreground">{fmt(tooltip.node.total_amount_out)}</span>
            {tooltip.node.suspicious && (
              <>
                <span>Suspicion:</span>
                <span className="text-suspicious font-bold">{tooltip.node.suspicion_score.toFixed(1)}%</span>
                <span>Rings:</span>
                <span className="text-warning">{tooltip.node.ring_ids.join(', ')}</span>
              </>
            )}
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 text-[10px] text-muted-foreground bg-background/80 backdrop-blur rounded-md px-3 py-1.5">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-highlight inline-block" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-suspicious inline-block" /> Suspicious</span>
        <span>Scroll to zoom · Drag nodes</span>
      </div>
    </div>
  );
};

export default GraphVisualization;
