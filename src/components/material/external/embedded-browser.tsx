"use client"

const EmbeddedBrowser = ( { className = '', src }: { className?: string, src: string } ) => {

    return (
        <iframe
        
            src={src}
            title="Embedded Browser"
            width="100%"
            height="100%"
            className={`${className} border-none pb-3 overflow-hidden`}

        />
    )

}

export default EmbeddedBrowser
