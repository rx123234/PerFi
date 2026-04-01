import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { SankeyData } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: SankeyData | null;
}

const COLORS = [
  "#6366F1", "#22C55E", "#F59E0B", "#EC4899", "#06B6D4",
  "#8B5CF6", "#F97316", "#14B8A6", "#EF4444", "#84CC16",
  "#A855F7", "#0EA5E9", "#F43F5E", "#10B981",
];

export default function SankeyFlow({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0 || data.links.length === 0) return;

    const svg = svgRef.current;
    const width = svg.clientWidth || 600;
    const height = Math.max(300, data.nodes.length * 25);

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const sankeyLayout = sankey<{ name: string }, { value: number }>()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 6]]);

    const { nodes, links } = sankeyLayout({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Links
    const linkGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    linkGroup.setAttribute("fill", "none");
    linkGroup.setAttribute("stroke-opacity", "0.25");
    svg.appendChild(linkGroup);

    const pathGen = sankeyLinkHorizontal();
    for (const link of links) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathGen(link as never) || "");
      const sourceIdx = typeof link.source === "object" ? ((link.source as { index?: number }).index ?? 0) : Number(link.source);
      path.setAttribute("stroke", COLORS[sourceIdx % COLORS.length]);
      path.setAttribute("stroke-width", String(Math.max(1, (link as never as { width: number }).width)));
      linkGroup.appendChild(path);
    }

    // Nodes
    const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(nodeGroup);

    for (const node of nodes) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(node.x0));
      rect.setAttribute("y", String(node.y0));
      rect.setAttribute("width", String((node.x1 ?? 0) - (node.x0 ?? 0)));
      rect.setAttribute("height", String(Math.max(1, (node.y1 ?? 0) - (node.y0 ?? 0))));
      rect.setAttribute("rx", "3");
      const idx = node.index ?? 0;
      rect.setAttribute("fill", COLORS[idx % COLORS.length]);
      nodeGroup.appendChild(rect);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const isLeft = (node.x0 ?? 0) < width / 2;
      text.setAttribute("x", String(isLeft ? (node.x1 ?? 0) + 6 : (node.x0 ?? 0) - 6));
      text.setAttribute("y", String(((node.y0 ?? 0) + (node.y1 ?? 0)) / 2));
      text.setAttribute("dy", "0.35em");
      text.setAttribute("text-anchor", isLeft ? "start" : "end");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-family", "Geist, system-ui, sans-serif");
      text.setAttribute("fill", "var(--muted-foreground)");
      text.textContent = `${node.name} (${formatCurrency(node.value ?? 0)})`;
      nodeGroup.appendChild(text);
    }

    return () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, [data]);

  if (!data || data.nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Money Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No flow data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Money Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <svg ref={svgRef} className="w-full" style={{ minHeight: 300 }} />
      </CardContent>
    </Card>
  );
}
