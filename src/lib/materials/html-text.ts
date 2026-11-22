/** Very small HTML -> plain text conversion for feeding memo content to the model. */
export const htmlToPlainText = ( html: string | null | undefined, maxLength?: number ) => {

    if( !html ) return "";

    let text = html
        .replace( /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "" )
        .replace( /<\s*br\s*\/?>/gi, "\n" )
        .replace( /<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, "\n" )
        .replace( /<li[^>]*>/gi, "- " )
        .replace( /<[^>]+>/g, "" )
        .replace( /&nbsp;/g, " " )
        .replace( /&amp;/g, "&" )
        .replace( /&lt;/g, "<" )
        .replace( /&gt;/g, ">" )
        .replace( /&quot;/g, "\"" )
        .replace( /&#39;/g, "'" )
        .replace( /\n{3,}/g, "\n\n" )
        .trim();

    if( maxLength && text.length > maxLength ) text = text.slice( 0, maxLength ) + "…";

    return text;

}
