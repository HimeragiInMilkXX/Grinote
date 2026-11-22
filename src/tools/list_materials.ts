import { htmlToPlainText } from "@/lib/materials/html-text";
import { tool } from "ai";
import { z } from "zod";
import { loadProjectMaterials, publicLink } from "./material-data";

export const listMaterials = tool({
    description:
        "List the project's saved materials (files, links, memos) with their ids, type, label, description, external URL, favourite/pinned flags, " +
        "the ids and names of the tree nodes each one is linked to, and a short excerpt of its memo. " +
        "Call this before recommending, linking or unlinking materials, or before writing a memo for an existing material. Read-only. " +
        "Use read_material for the full memo of one material.",
    inputSchema: z.object({
        project_id: z.string().describe("The exact active project_id from the system prompt."),
    }),
    execute: async ({ project_id }) => {

        const { materials, links, nodeNames } = await loadProjectMaterials( project_id );

        return {
            materials: materials.map( m => {
                const linked = links.filter( l => l.material_id === m.id ).map( l => ( { node_id: l.node_id, task_name: nodeNames[l.node_id] ?? null } ) );
                return {
                    id: m.id,
                    name: m.name,
                    type: m.type,
                    label: m.label || null,
                    description: m.description || null,
                    url: publicLink( m ),
                    is_favourite: !!m.is_favourite,
                    pinned: !!m.pinned_at,
                    linked_nodes: linked,
                    memo_excerpt: htmlToPlainText( m.content, 300 ) || null,
                };
            } ),
        };

    },
});
