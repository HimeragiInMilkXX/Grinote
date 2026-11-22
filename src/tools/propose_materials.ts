import { linkKey, MAX_MATERIAL_OPS, normalizeMaterialOps, type MaterialOps } from "@/lib/materials/proposal";
import { tool } from "ai";
import { z } from "zod";
import { loadProjectMaterials, publicLink } from "./material-data";

const nodeIds = z.array( z.string() ).optional().default( [] ).describe( "Exact node ids from get_graph_info, never the root (isRoot) node. [] if none." );

const pair = z.object({
    material_id: z.number().int().describe( "Existing material id from list_materials." ),
    node_id: z.string().describe( "Exact node id from get_graph_info; never the root (isRoot) node." ),
});

export const proposeMaterialsInputSchema = z.object({
    project_id: z.string().describe( "The exact active project_id from the system prompt." ),
    summary: z.string().max( 250 ).optional().default( "マテリアルの提案" ).describe( "One short sentence describing this proposal." ),
    create_external: z.array( z.object({
        name: z.string().min( 1 ).max( 200 ).describe( "Short title of the online resource." ),
        url: z.string().describe( "Full http(s) URL copied exactly from a web_search result. Never invent URLs." ),
        description: z.string().max( 400 ).optional().describe( "One sentence on why it helps." ),
        label: z.string().max( 50 ).optional().describe( "Optional short category label." ),
        node_ids: nodeIds,
    }) ).optional().default( [] ).describe( "Online resources to save as new external-link materials, optionally linked to nodes." ),
    link: z.array( pair ).optional().default( [] ).describe( "Connect an existing material to a node." ),
    unlink: z.array( pair ).optional().default( [] ).describe( "Remove an existing material-node link." ),
    suggestions: z.array( z.object({
        title: z.string().min( 1 ).max( 200 ).describe( "What the user should look for or upload, e.g. a textbook chapter or their own notes." ),
        reason: z.string().max( 400 ).describe( "Why it helps." ),
        search_query: z.string().max( 200 ).optional().describe( "A search query the user can try." ),
        node_ids: nodeIds,
    }) ).optional().default( [] ).describe( "Ideas the user should search for or upload themselves (nothing is created)." ),
});

export type ProposeMaterialsOutput = {
    status: "draft";
    project_id: string;
    summary: string;
    ops: MaterialOps;
    /** id -> display name, for the review card */
    materialNames: Record<number, string>;
    nodeNames: Record<string, string>;
    warnings: string[];
};

export const proposeMaterials = tool({
    description:
        "Create a material DRAFT for the user to review; nothing is saved until the user accepts the review card. " +
        "Use it to (1) save useful online resources found with web_search as external-link materials, (2) link or unlink existing materials and tree nodes, " +
        "(3) suggest things the user should search for or upload. Call list_materials and get_graph_info first and use their exact ids. " +
        `At most ${MAX_MATERIAL_OPS} items. If it returns an error, fix the arguments and retry once. After success, summarize briefly and stop.`,
    inputSchema: proposeMaterialsInputSchema,
    execute: async ({ project_id, summary, ...input }): Promise<ProposeMaterialsOutput> => {

        const { materials, links, nodeNames, rootIds } = await loadProjectMaterials( project_id );

        const { ops, warnings } = normalizeMaterialOps( input as Partial<MaterialOps>, {
            materialIds: new Set( materials.map( m => m.id ) ),
            nodeIds: new Set( Object.keys( nodeNames ) ),
            rootIds,
            links: new Set( links.map( linkKey ) ),
            existingUrls: new Set( materials.flatMap( m => {
                const url = publicLink( m );
                if( !url ) return [];
                try { return [ new URL( url ).toString() ]; } catch { return []; }
            } ) ),
        } );

        return {
            status: "draft",
            project_id,
            summary,
            ops,
            materialNames: Object.fromEntries( materials.map( m => [ m.id, m.name ] ) ),
            nodeNames,
            warnings,
        };

    },
    toModelOutput: ({ output }) => {
        const { ops, warnings } = output;
        const lines = [
            `Material draft created (not saved): ${ops.create_external.length} new links, ${ops.link.length} links, ${ops.unlink.length} unlinks, ${ops.suggestions.length} suggestions.`,
            ...ops.create_external.map( c => `+ ${c.name} (${c.url})` ),
            ...ops.link.map( l => `link ${output.materialNames[l.material_id]} -> ${output.nodeNames[l.node_id]}` ),
            ...ops.unlink.map( l => `unlink ${output.materialNames[l.material_id]} -x- ${output.nodeNames[l.node_id]}` ),
            ...ops.suggestions.map( s => `? ${s.title}` ),
        ];
        if( warnings.length ) lines.push( `Warnings: ${warnings.join( " " )}` );
        lines.push( "The review card is now shown to the user. Summarize briefly and stop; do not create another draft." );
        return { type: "text", value: lines.join( "\n" ) };
    },
});
