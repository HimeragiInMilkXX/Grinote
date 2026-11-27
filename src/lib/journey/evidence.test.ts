import { describe, expect, it } from "vitest";
import { asEvidenceItems, detectEvidenceKind, EVIDENCE_ACCEPT, EVIDENCE_LIMITS, EVIDENCE_MIME_TYPES, evidencePath, isEvidencePathFor, validateEvidenceFile } from "./evidence";
import { evidenceAddedAfterAnalysis } from "./journal";
import type { JourneyAnalysis } from "./analysis";

const MB = 1024 * 1024;
const USER = "11111111-2222-3333-4444-555555555555";
const PROJECT = "66666666-7777-8888-9999-000000000000";

describe( "detectEvidenceKind", () => {

    it( "uses the MIME type and canonicalises aliases", () => {
        expect( detectEvidenceKind( { name: "a.jpg", type: "image/jpeg" } ) ).toEqual( { kind: "image", mime: "image/jpeg", ext: "jpg" } );
        expect( detectEvidenceKind( { name: "voice", type: "audio/mp3" } ) ).toEqual( { kind: "audio", mime: "audio/mpeg", ext: "mp3" } );
        expect( detectEvidenceKind( { name: "rec.wav", type: "audio/x-wav" } ) ).toEqual( { kind: "audio", mime: "audio/wav", ext: "wav" } );
        expect( detectEvidenceKind( { name: "clip.MOV", type: "video/quicktime" } ) ).toEqual( { kind: "video", mime: "video/quicktime", ext: "mov" } );
        expect( detectEvidenceKind( { name: "x.webm", type: "video/webm;codecs=vp9" } )?.kind ).toBe( "video" );
    });

    it( "derives the extension from the type when the name disagrees", () => {
        expect( detectEvidenceKind( { name: "photo.txt", type: "image/png" } ) ).toEqual( { kind: "image", mime: "image/png", ext: "png" } );
    });

    it( "falls back to the extension only for an unknown/empty type", () => {
        expect( detectEvidenceKind( { name: "IMG_1.HEIC", type: "" } ) ).toEqual( { kind: "image", mime: "image/heic", ext: "heic" } );
        expect( detectEvidenceKind( { name: "a.mp3", type: "application/octet-stream" } )?.kind ).toBe( "audio" );
        expect( detectEvidenceKind( { name: "a.mp3", type: "text/plain" } ) ).toBeNull();
    });

    it( "rejects unsupported formats", () => {
        expect( detectEvidenceKind( { name: "doc.pdf", type: "application/pdf" } ) ).toBeNull();
        expect( detectEvidenceKind( { name: "voice.m4a", type: "audio/x-m4a" } ) ).toBeNull();
        expect( detectEvidenceKind( { name: "anim.gif", type: "image/gif" } ) ).toBeNull();
        expect( detectEvidenceKind( { name: "noext", type: "" } ) ).toBeNull();
    });

});

describe( "validateEvidenceFile", () => {

    it( "checks the size per kind", () => {
        expect( validateEvidenceFile( { name: "a.jpg", type: "image/jpeg", size: 10 * MB } ).ok ).toBe( true );
        expect( validateEvidenceFile( { name: "a.jpg", type: "image/jpeg", size: 10 * MB + 1 } ).ok ).toBe( false );
        expect( validateEvidenceFile( { name: "a.mp4", type: "video/mp4", size: 50 * MB } ).ok ).toBe( true );
        expect( validateEvidenceFile( { name: "a.mp3", type: "audio/mpeg", size: 26 * MB } ).ok ).toBe( false );
        expect( validateEvidenceFile( { name: "a.mp3", type: "audio/mpeg", size: 0 } ).ok ).toBe( false );
    });

    it( "explains the problem in Japanese", () => {
        const r = validateEvidenceFile( { name: "big.mp4", type: "video/mp4", size: 60 * MB } );
        expect( r.ok ).toBe( false );
        if( !r.ok ) expect( r.error ).toContain( "動画は50MBまで" );
    });

});

describe( "paths", () => {

    it( "builds and recognises the record folder", () => {
        const path = evidencePath( USER, PROJECT, 42, "abcdef12-3456-7890-abcd-ef1234567890", "jpg" );
        expect( path ).toBe( `${USER}/${PROJECT}/42/abcdef12-3456-7890-abcd-ef1234567890.jpg` );
        expect( isEvidencePathFor( path, USER, PROJECT, 42 ) ).toBe( true );
        expect( isEvidencePathFor( path, USER, PROJECT, 43 ) ).toBe( false );
        expect( isEvidencePathFor( `${USER}/${PROJECT}/42/../x/abcdef12.jpg`, USER, PROJECT, 42 ) ).toBe( false );
        expect( isEvidencePathFor( `${USER}/${PROJECT}/42/sub/abcdef12.jpg`, USER, PROJECT, 42 ) ).toBe( false );
    });

});

describe( "asEvidenceItems", () => {

    it( "keeps valid items and drops other shapes", () => {
        const items = asEvidenceItems( [
            { id: "abcdef12-3456", path: "p", kind: "image", mime: "image/png", name: "a.png", size: "12", uploadedAt: "2026-11-28T00:00:00Z" },
            { id: "abcdef12-3457", path: "p", kind: "pdf" },
            { id: "../x", path: "p", kind: "audio" },
            null,
            "x",
        ] );
        expect( items ).toEqual( [ { id: "abcdef12-3456", path: "p", kind: "image", mime: "image/png", name: "a.png", size: 12, uploadedAt: "2026-11-28T00:00:00Z" } ] );
        expect( asEvidenceItems( null ) ).toEqual( [] );
    });

});

describe( "config", () => {

    it( "accepts every listed format", () => {
        for( const limits of Object.values( EVIDENCE_LIMITS ) ) {
            for( const ext of limits.ext ) {
                expect( EVIDENCE_ACCEPT ).toContain( `.${ext}` );
                expect( EVIDENCE_MIME_TYPES ).toContain( limits.mimes[ ext ] );
            }
        }
    });

});

describe( "evidenceAddedAfterAnalysis", () => {

    const item = ( id: string ) => ( { id, path: "p", kind: "image" as const, mime: "image/png", name: id, size: 1, uploadedAt: "" } );
    const analysis = { evidence: [ { id: "a1234567", kind: "image", name: "a", observed: "x", assessment: "", analyzed: true } ] } as unknown as JourneyAnalysis;

    it( "lists files that the analysis didn't look at", () => {
        expect( evidenceAddedAfterAnalysis( [ item( "a1234567" ), item( "b1234567" ) ], analysis ).map( e => e.id ) ).toEqual( [ "b1234567" ] );
        // removed files are fine
        expect( evidenceAddedAfterAnalysis( [], analysis ) ).toEqual( [] );
        expect( evidenceAddedAfterAnalysis( [ item( "b1234567" ) ], null ) ).toEqual( [] );
        expect( evidenceAddedAfterAnalysis( [ item( "b1234567" ) ], { } as JourneyAnalysis ).length ).toBe( 1 );
    });

});
