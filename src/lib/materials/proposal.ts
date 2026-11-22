/** Pure validation for AI material proposals (propose_materials). Unit-tested. */

export const MAX_MATERIAL_OPS = 20;

export type MaterialLinkPair = { material_id: number, node_id: string };

export type CreateExternalOp = { name: string, url: string, description?: string, label?: string, node_ids: string[] };

export type MaterialSuggestion = { title: string, reason: string, search_query?: string, node_ids: string[] };

export type MaterialOps = {
    create_external: CreateExternalOp[],
    link: MaterialLinkPair[],
    unlink: MaterialLinkPair[],
    suggestions: MaterialSuggestion[],
};

export type MaterialProposalContext = {
    materialIds: Set<number>,
    nodeIds: Set<string>,
    /** the root goal node(s); materials can't be linked to them */
    rootIds?: Set<string>,
    /** existing links as "materialId:nodeId" */
    links: Set<string>,
    /** links of existing external materials (to avoid duplicates) */
    existingUrls: Set<string>,
};

export const linkKey = ( p: MaterialLinkPair ) => `${p.material_id}:${p.node_id}`;

const normalizeUrl = ( raw: string ) => {

    let url: URL;

    try { url = new URL( raw.trim() ); } catch { return null; }

    if( url.protocol !== "http:" && url.protocol !== "https:" ) return null;

    return url.toString();

}

/**
 * Validates and cleans a proposal. Throws on errors the model should fix (unknown ids, bad URLs);
 * drops harmless no-ops (duplicates, already linked, not linked) with a warning.
 */
export const normalizeMaterialOps = ( raw: Partial<MaterialOps>, ctx: MaterialProposalContext ): { ops: MaterialOps, warnings: string[] } => {

    const warnings: string[] = [];
    const errors: string[] = [];

    const checkNodes = ( ids: string[] | undefined, where: string ) => {
        const out: string[] = [];
        for( const id of ids ?? [] ) {
            if( !ctx.nodeIds.has( id ) ) errors.push( `${where}: node_id "${id}" does not exist in this project (use exact ids from get_graph_info)` );
            else if( ctx.rootIds?.has( id ) ) errors.push( `${where}: node_id "${id}" is the root goal; materials can't be linked to the root, use a task under it` );
            else if( !out.includes( id ) ) out.push( id );
        }
        return out;
    };

    // create_external
    const create_external: CreateExternalOp[] = [];
    const seenUrls = new Set<string>();

    for( const [ i, c ] of ( raw.create_external ?? [] ).entries() ) {

        const url = normalizeUrl( c.url ?? "" );
        const name = ( c.name ?? "" ).trim();

        if( !url ) { errors.push( `create_external[${i}]: url must be a full http(s) URL copied from web_search results` ); continue; }
        if( !name ) { errors.push( `create_external[${i}]: name is required` ); continue; }

        const node_ids = checkNodes( c.node_ids, `create_external[${i}]` );

        if( seenUrls.has( url ) ) { warnings.push( `同じURLの重複を除外しました: ${url}` ); continue; }
        if( ctx.existingUrls.has( url ) ) { warnings.push( `既に登録済みのURLを除外しました: ${url}` ); continue; }

        seenUrls.add( url );
        create_external.push( { name: name.slice( 0, 200 ), url, description: c.description?.trim() || undefined, label: c.label?.trim() || undefined, node_ids } );

    }

    // link / unlink
    const checkPairs = ( pairs: MaterialLinkPair[] | undefined, kind: "link" | "unlink" ) => {

        const out: MaterialLinkPair[] = [];
        const seen = new Set<string>();

        for( const [ i, p ] of ( pairs ?? [] ).entries() ) {

            const material_id = Number( p.material_id );

            if( !ctx.materialIds.has( material_id ) ) { errors.push( `${kind}[${i}]: material_id ${p.material_id} does not exist (use ids from list_materials)` ); continue; }
            if( !ctx.nodeIds.has( p.node_id ) ) { errors.push( `${kind}[${i}]: node_id "${p.node_id}" does not exist (use exact ids from get_graph_info)` ); continue; }
            if( kind === "link" && ctx.rootIds?.has( p.node_id ) ) { errors.push( `link[${i}]: node_id "${p.node_id}" is the root goal; materials can't be linked to the root, use a task under it` ); continue; }

            const pair = { material_id, node_id: p.node_id };
            const key = linkKey( pair );

            if( seen.has( key ) ) continue;
            seen.add( key );

            const linked = ctx.links.has( key );

            if( kind === "link" && linked ) { warnings.push( `既にリンク済みのため除外: material ${material_id}` ); continue; }
            if( kind === "unlink" && !linked ) { warnings.push( `リンクされていないため除外: material ${material_id}` ); continue; }

            out.push( pair );

        }

        return out;

    };

    const link = checkPairs( raw.link, "link" );
    const unlink = checkPairs( raw.unlink, "unlink" );

    // suggestions
    const suggestions: MaterialSuggestion[] = [];

    for( const [ i, s ] of ( raw.suggestions ?? [] ).entries() ) {

        const title = ( s.title ?? "" ).trim();

        if( !title ) { errors.push( `suggestions[${i}]: title is required` ); continue; }

        suggestions.push( { title: title.slice( 0, 200 ), reason: ( s.reason ?? "" ).trim().slice( 0, 400 ), search_query: s.search_query?.trim() || undefined, node_ids: checkNodes( s.node_ids, `suggestions[${i}]` ) } );

    }

    if( errors.length ) throw new Error( `Invalid material proposal:\n- ${errors.join( "\n- " )}` );

    const total = create_external.length + link.length + unlink.length + suggestions.length;

    if( total === 0 ) throw new Error( warnings.length
        ? `Nothing left to propose after removing no-ops: ${warnings.join( " " )}`
        : "Empty proposal: provide at least one of create_external, link, unlink or suggestions." );

    if( total > MAX_MATERIAL_OPS ) throw new Error( `Too many items (${total}); use at most ${MAX_MATERIAL_OPS}.` );

    return { ops: { create_external, link, unlink, suggestions }, warnings };

}
