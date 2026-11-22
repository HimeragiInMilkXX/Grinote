import { describe, expect, it } from "vitest";
import { detectMaterialType, fileBaseName, isFileCompatibleWithType } from "./detect-type";

describe( "detectMaterialType", () => {

    it( "maps images and pdf to readonlys", () => {
        expect( detectMaterialType( { name: "a.png", type: "image/png" } ) ).toBe( "readonlys" );
        expect( detectMaterialType( { name: "a.pdf", type: "application/pdf" } ) ).toBe( "readonlys" );
    } );

    it( "maps audio and video to playables", () => {
        expect( detectMaterialType( { name: "a.mp3", type: "audio/mpeg" } ) ).toBe( "playables" );
        expect( detectMaterialType( { name: "a.mp4", type: "video/mp4" } ) ).toBe( "playables" );
    } );

    it( "falls back to the extension when the MIME type is empty", () => {
        expect( detectMaterialType( { name: "clip.M4A", type: "" } ) ).toBe( "playables" );
        expect( detectMaterialType( { name: "scan.PDF", type: "" } ) ).toBe( "readonlys" );
    } );

    it( "returns null for unsupported files", () => {
        expect( detectMaterialType( { name: "a.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } ) ).toBeNull();
        expect( detectMaterialType( { name: "noext", type: "" } ) ).toBeNull();
    } );

    it( "checks compatibility", () => {
        expect( isFileCompatibleWithType( { name: "a.png", type: "image/png" }, "readonlys" ) ).toBe( true );
        expect( isFileCompatibleWithType( { name: "a.png", type: "image/png" }, "playables" ) ).toBe( false );
    } );

} );

describe( "fileBaseName", () => {
    it( "strips only the last extension", () => {
        expect( fileBaseName( "report.final.pdf" ) ).toBe( "report.final" );
        expect( fileBaseName( ".env" ) ).toBe( ".env" );
        expect( fileBaseName( "plain" ) ).toBe( "plain" );
    } );
} );
