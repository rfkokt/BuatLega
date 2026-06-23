import { useMemo, useCallback } from 'react';
import { ResponsiveTreeMap } from '@nivo/treemap';
import type { FileNode } from '../../types';
import { formatBytes } from '../../lib/format';

interface TreemapProps {
  data: FileNode;
  onDrillDown: (node: FileNode) => void;
}

interface NivoNode {
  name: string;
  path: string;
  fileType: string;
  size?: number;
  children?: NivoNode[];
}

const CATEGORY_COLORS: Record<string, string> = {
  System: '#6366F1',
  Application: '#10B981',
  Document: '#3B82F6',
  Media: '#EC4899',
  Code: '#8B5CF6',
  DevCache: '#06B6D4',
  Cache: '#F59E0B',
  Log: '#F97316',
  Archive: '#EF4444',
  Trash: '#E11D48',
  Other: '#64748B',
};

const VIBRANT_PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#14B8A6',
  '#A855F7', '#F43F5E', '#FB923C', '#22D3EE', '#34D399',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getNodeColor(node: NivoNode, depth: number): string {
  if (node.fileType && CATEGORY_COLORS[node.fileType] && node.fileType !== 'Other') {
    return CATEGORY_COLORS[node.fileType];
  }
  
  if (!node.children || node.children.length === 0) {
    const hash = hashString(node.name);
    return VIBRANT_PALETTE[hash % VIBRANT_PALETTE.length];
  }
  
  const childColors: Record<string, number> = {};
  let maxSize = 0;
  let dominantColor = '';
  
  for (const child of node.children) {
    const color = getNodeColor(child, depth + 1);
    const size = child.size || 0;
    childColors[color] = (childColors[color] || 0) + size;
    if (childColors[color] > maxSize) {
      maxSize = childColors[color];
      dominantColor = color;
    }
  }
  
  return dominantColor || VIBRANT_PALETTE[hashString(node.name) % VIBRANT_PALETTE.length];
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

export function Treemap({ data, onDrillDown }: TreemapProps) {
  const nivoData = useMemo(() => transformToNivo(data, 1), [data]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, FileNode>();
    const walk = (node: FileNode, depth: number) => {
      map.set(node.path, node);
      if (depth <= 0 || !node.children) return;

      node.children
        .filter((child) => child.size > 0)
        .sort((a, b) => b.size - a.size)
        .slice(0, 50)
        .forEach((child) => walk(child, depth - 1));
    };
    walk(data, 2);
    return map;
  }, [data]);

  const getColor = useCallback((node: any) => {
    const baseColor = getNodeColor(node.data as NivoNode, node.depth);
    if (node.isLeaf) {
      return baseColor;
    }
    return darkenColor(baseColor, 0.6);
  }, []);

  const handleClick = useCallback((node: any) => {
    const path = (node.data as NivoNode)?.path;
    const originalNode = path ? nodeMap.get(path) : null;
    if (originalNode?.is_dir && originalNode.children?.length) {
      onDrillDown(originalNode);
    }
  }, [nodeMap, onDrillDown]);

  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 z-10">
        <ResponsiveTreeMap
          data={nivoData}
          identity="name"
          value="size"
          valueFormat={(v) => formatBytes(v)}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          labelSkipSize={30}
          label={(node) => {
            const name = node.id as string;
            if (node.height === 0) {
              return name.length > 16 ? name.slice(0, 14) + '…' : name;
            }
            return name.length > 22 ? name.slice(0, 20) + '…' : name;
          }}
          labelTextColor={{ from: 'color', modifiers: [['brighter', 3]] }}
          parentLabelPosition="top"
          parentLabelTextColor="#ffffff"
          parentLabelSize={13}
          parentLabelPadding={8}
          colors={getColor}
          borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
          borderWidth={2}
          nodeOpacity={0.95}
          animate={true}
          motionConfig="gentle"
          onClick={handleClick}
          tooltip={({ node }) => (
            <div className="px-4 py-3 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl bg-slate-900/90 max-w-xs">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: node.color }}
                />
                <p className="text-sm font-semibold text-white truncate">{node.id}</p>
              </div>
              <p className="text-xs text-white/60 font-medium">
                {formatBytes(node.value)}
                {node.isLeaf && (node.data as any)?.fileType ? ` · ${(node.data as any).fileType}` : ' · Directory'}
              </p>
              {(node.data as any)?.children && (
                <p className="text-[10px] text-teal-400 mt-2 font-medium">Click to explore →</p>
              )}
            </div>
          )}
          theme={{
            labels: {
              text: {
                fontSize: 11,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: 600,
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              },
            },
          }}
        />
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-white/50 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/5">
        {Object.entries(CATEGORY_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function transformToNivo(node: FileNode, maxDepth: number = 1): NivoNode {
  if (node.children && node.children.length > 0) {
    const significantChildren = node.children
      .filter((c) => c.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, 50);

    if (maxDepth > 0) {
      return {
        name: node.name,
        path: node.path,
        fileType: node.file_type || 'Other',
        children: significantChildren.map(c => transformToNivo(c, maxDepth - 1)),
      };
    }

    return {
      name: node.name,
      path: node.path,
      fileType: node.file_type || 'Other',
      children: significantChildren.map(c => ({
        name: c.name,
        path: c.path,
        fileType: c.file_type || 'Other',
        size: c.size,
      })),
    };
  }

  return {
    name: node.name,
    path: node.path,
    fileType: node.file_type || 'Other',
    size: node.size,
  };
}
