import type { BlockDefinition } from "./types";

export type BlockLookup = Record<string, BlockDefinition | undefined>;

export function createBlocksByType(blocks: BlockDefinition[]): BlockLookup {
  return Object.fromEntries(blocks.map((block) => [block.type, block]));
}

export function groupedBlocks(blocks: BlockDefinition[]) {
  return blocks.reduce<Record<string, BlockDefinition[]>>((acc, block) => {
    acc[block.category] = acc[block.category] ?? [];
    acc[block.category].push(block);
    return acc;
  }, {});
}
