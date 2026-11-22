import { describe, expect, it } from "vitest";
import { markdownToMemoHtml } from "./markdown";
import { htmlToPlainText } from "./html-text";

describe( "markdownToMemoHtml", () => {

    it( "renders headings, lists and tables", () => {
        const html = markdownToMemoHtml( "# Title\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |" );
        expect( html ).toContain( "<h1>Title</h1>" );
        expect( html ).toContain( "<li>a</li>" );
        expect( html ).toContain( "<table>" );
    } );

    it( "escapes raw HTML instead of passing it through", () => {
        const html = markdownToMemoHtml( "<script>alert(1)</script>\n\ntext" );
        expect( html ).not.toContain( "<script>" );
        expect( html ).toContain( "&lt;script&gt;" );
    } );

} );

describe( "htmlToPlainText", () => {
    it( "strips tags and truncates", () => {
        expect( htmlToPlainText( "<p>Hello <b>world</b></p><ul><li>x</li></ul>" ) ).toBe( "Hello world\n- x" );
        expect( htmlToPlainText( "<p>abcdef</p>", 3 ) ).toBe( "abc…" );
        expect( htmlToPlainText( null ) ).toBe( "" );
    } );
} );
