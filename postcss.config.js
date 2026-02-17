/** @type {import('postcss-load-config').Config} */
const config = {
	plugins: [
		require( '@tailwindcss/postcss' ),
		require( 'postcss-nested' ), // Flatten nested CSS before prefixing
		require( 'postcss-prefix-selector' )( {
			prefix: '.tailwind',
			// Only apply prefix to tailwind.css, not webpack-processed SCSS
			includeFiles: [ /tailwind\.css$/ ],
			transform( prefix, selector, prefixedSelector, filePath ) {
				// Replace html/body/:root with the prefix
				if ( selector.match( /^(html|body|:root)/ ) ) {
					return selector.replace( /^([^\s]*)/, `$1 ${ prefix }` );
				}
				// Skip already-scoped selectors
				if ( selector.startsWith( '.tailwind' ) ) {
					return selector;
				}
				return prefixedSelector;
			},
		} ),
		require( 'autoprefixer' ),
	],
};

module.exports = config;
