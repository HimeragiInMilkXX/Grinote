import { tool } from "ai";
import { markdownToMemoHtml } from "@/lib/materials/markdown";
import { z } from "zod";
import { loadProjectMaterials } from "./material-data";

export type DraftMemoOutput = {
    status: "draft";
    project_id: string;
    /** target material, or null when the user should create a new memo */
    material_id: number | null;
    material_name: string | null;
    title: string;
    mode: "replace" | "append";
    html: string;
};

export const draftMemo = tool({
    description:
        "Write a memo DRAFT for the user. Nothing is saved: the user sees a preview card and chooses to insert it into the material's memo editor (then saves) or create a new memo. " +
        "Write the memo body in Markdown (headings, lists, bold, tables, links). " +
        "Use material_id when the memo belongs to an existing material (from list_materials or the page context); omit it to propose a new memo. " +
        "mode 'append' adds to the existing memo, 'replace' rewrites it. After success, say one short sentence and stop.",
    inputSchema: z.object({
        project_id: z.string().describe( "The exact active project_id from the system prompt." ),
        material_id: z.number().int().optional().describe( "Target material id. Omit to propose a new memo material." ),
        title: z.string().min( 1 ).max( 120 ).describe( "Short title; used as the name when a new memo is created." ),
        mode: z.enum( [ "append", "replace" ] ).optional().default( "append" ).describe( "append (default) adds to the end; replace rewrites the whole memo." ),
        markdown: z.string().min( 1 ).max( 20000 ).describe( "The memo body in Markdown. Do not wrap it in a code block." ),
    }),
    execute: async ({ project_id, material_id, title, mode, markdown }): Promise<DraftMemoOutput> => {

        let material_name: string | null = null;

        if( material_id !== undefined ) {

            const { materials } = await loadProjectMaterials( project_id );
            const m = materials.find( mat => mat.id === material_id );

            if( !m ) throw new Error( `Material ${material_id} does not exist in this project. Call list_materials, or omit material_id to propose a new memo.` );

            material_name = m.name;

        }

        // small models sometimes wrap the whole memo in ```markdown fences
        const body = markdown.trim().replace( /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i, "$1" );

        return {
            status: "draft",
            project_id,
            material_id: material_id ?? null,
            material_name,
            title,
            mode,
            html: markdownToMemoHtml( body ),
        };

    },
    toModelOutput: ({ output }) => ( {
        type: "text",
        value: `Memo draft "${output.title}" created for ${output.material_name ? `material "${output.material_name}" (${output.mode})` : "a new memo"}. ` +
            "It is NOT saved; the user reviews the preview card and inserts it into the editor. Tell the user briefly and stop.",
    } ),
});
