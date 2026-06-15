"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { NodeIcon } from "@/components/workflow/NodeIcon";
import { groupedBlocks } from "@/lib/workflow/block-utils";
import type { BlockDefinition } from "@/lib/workflow/types";

type NodePaletteProps = {
  blocks: BlockDefinition[];
  onAddBlock: (blockType: string) => void;
};

export function NodePalette({ blocks, onAddBlock }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const visibleBlocks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return blocks;
    return blocks.filter((block) =>
      [block.label, block.description, block.category, block.type]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [blocks, query]);

  const groups = groupedBlocks(visibleBlocks);

  return (
    <aside className="flex h-full w-[310px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line p-4">
        <div className="text-xs font-semibold uppercase text-zinc-500">Blocks</div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks"
            className="min-w-0 flex-1 bg-transparent text-sm text-baited-ink outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto p-3">
        {Object.entries(groups).map(([category, categoryBlocks]) => (
          <section key={category} className="mb-5">
            <div className="mb-2 px-1 text-xs font-semibold text-zinc-500">{category}</div>
            <div className="space-y-2">
              {categoryBlocks.map((block) => (
                <button
                  key={block.type}
                  draggable
                  onClick={() => onAddBlock(block.type)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/baited-block", block.type);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="group flex w-full items-start gap-3 rounded-md border border-line bg-panel2 p-3 text-left transition hover:border-baited-green/70 hover:bg-zinc-800"
                  title="Click to add, or drag into the canvas"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-700 bg-canvas text-zinc-200 group-hover:border-baited-green/60 group-hover:text-baited-green">
                    <NodeIcon icon={block.icon} />
                  </div>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-baited-ink">
                      {block.label}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-zinc-500">
                      {block.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
