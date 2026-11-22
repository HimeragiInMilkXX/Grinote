import { marked } from "marked";

/** Markdown -> HTML for the Tiptap editor. Raw HTML in the markdown is escaped; Tiptap's schema drops anything unsupported. */
export const markdownToMemoHtml = ( markdown: string ) => {

    const escapeHtml = ( s: string ) => s.replace( /&/g, "&amp;" ).replace( /</g, "&lt;" ).replace( />/g, "&gt;" );

    const renderer = new marked.Renderer();
    renderer.html = ( { text } ) => escapeHtml( text );

    return marked.parse( markdown, { async: false, gfm: true, breaks: false, renderer } ) as string;

}
