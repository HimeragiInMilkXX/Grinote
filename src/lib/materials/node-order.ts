export type PickerNode = { id: string, task_name: string, parent_node_id: string | null, isRoot: boolean, isCompleted: boolean };

/** Depth-first order of nodes (root first) with their depth, for indented pickers. Orphans are appended at depth 0. */
export const orderNodesByTree = <T extends PickerNode>( nodes: T[] ): ( T & { depth: number } )[] => {

    const children = new Map<string | null, T[]>();
    nodes.forEach( n => {
        const key = n.parent_node_id && nodes.some( p => p.id === n.parent_node_id ) ? n.parent_node_id : null;
        children.set( key, [ ...( children.get( key ) ?? [] ), n ] );
    } );

    const out: ( T & { depth: number } )[] = [];
    const seen = new Set<string>();

    const visit = ( n: T, depth: number ) => {
        if( seen.has( n.id ) ) return;
        seen.add( n.id );
        out.push( { ...n, depth } );
        ( children.get( n.id ) ?? [] )
            .slice()
            .sort( ( a, b ) => a.task_name.localeCompare( b.task_name, undefined, { numeric: true } ) )
            .forEach( c => visit( c, depth + 1 ) );
    };

    const tops = ( children.get( null ) ?? [] ).sort( ( a, b ) => Number( b.isRoot ) - Number( a.isRoot ) );
    tops.forEach( t => visit( t, 0 ) );
    nodes.forEach( n => visit( n, 0 ) );

    return out;

}
