import ImageResize from 'tiptap-extension-resize-image'
import { mergeAttributes } from '@tiptap/core'

export const CleanImageResize = ImageResize.extend({
	addAttributes() {
		return {
		...this.parent?.(),
			width: {
				default: null,
				parseHTML: element => {
					// Parse width from inline styles (e.g. style="width: 196px;")
					const width = element.style.width || element.getAttribute('width')
					return width ? width.replace('px', '') : null
				},
				renderHTML: ({ width }) => width ? { style: `width: ${width}px` } : {},
			},
			height: {
				default: null,
				parseHTML: element => {
					// Parse width from inline styles (e.g. style="width: 196px;")
					const height = element.style.height || element.getAttribute('height')
					return height ? height.replace('px', '') : null
				},
				renderHTML: ({ height }) => height ? { style: `height: ${height}px` } : {},
			},
			containerStyle: {

				default: null,
				parseHTML: element => {
					return element.getAttribute('data-container-style') || element.getAttribute('style')
				},
				renderHTML: ( { containerStyle }) => containerStyle ? { style: containerStyle }: {}

			},
			wrapperStyle: {

				default: null,
				parseHTML: element => {
					return element.getAttribute('data-wrapper-style')
				},
				renderHTML: ( { wrapperStyle }) => wrapperStyle ? { style: wrapperStyle }: {}

			}
		}
	},

	renderHTML({ HTMLAttributes }) {
		// Only real <img> attributes end up in HTML
		return ['img', mergeAttributes(HTMLAttributes)]
	},
})
