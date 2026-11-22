import type { MaterialType } from "@/types/materials";

export type FileMaterialType = Extract<MaterialType, "readonlys" | "playables">;

const AUDIO_VIDEO_EXT = [ "mp3", "wav", "webm", "ogg", "m4a", "flac", "aac", "mp4", "mov", "mkv", "avi", "m4v" ];
const READONLY_EXT = [ "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif" ];

/** Guess the material type of an uploaded file from its MIME type (falls back to the extension). null = unsupported. */
export const detectMaterialType = ( file: { name: string, type: string } ): FileMaterialType | null => {

    const mime = ( file.type ?? "" ).toLowerCase();

    if( mime.startsWith( "audio/" ) || mime.startsWith( "video/" ) ) return "playables";
    if( mime.startsWith( "image/" ) || mime === "application/pdf" ) return "readonlys";

    const ext = file.name.split( "." ).pop()?.toLowerCase() ?? "";

    if( AUDIO_VIDEO_EXT.includes( ext ) ) return "playables";
    if( READONLY_EXT.includes( ext ) ) return "readonlys";

    return null;

}

/** Whether a file can be stored as the given material type. */
export const isFileCompatibleWithType = ( file: { name: string, type: string }, type: MaterialType ) => detectMaterialType( file ) === type;

/** "report.final.pdf" -> "report.final" */
export const fileBaseName = ( name: string ) => {

    const i = name.lastIndexOf( "." );

    return i > 0 ? name.slice( 0, i ) : name;

}
