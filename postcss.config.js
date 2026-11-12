/**
 * Namespace Tailwind's internal custom properties.
 *
 * Tailwind's `--tw-*` variables are not namespaced per build, so two Tailwind
 * bundles on the same page share one variable namespace. Yoast (wordpress-seo)
 * enqueues its Tailwind v3 bundle on our admin screens, and that bundle opens
 * with an *unlayered* `*, :after, :before, ::backdrop` reset that sets all 51 of
 * its `--tw-*` variables on every element on the page.
 *
 * We are Tailwind v4, so our utilities live in a real cascade layer
 * (`@layer utilities`) — and unlayered declarations beat any cascade layer
 * regardless of specificity. Yoast's `*` rule therefore overrode our own
 * utilities: `translate-x-[-50%] translate-y-[-50%]` resolved to `translate: 0`,
 * which un-centred every fixed-position modal (see #695 "Bug 8" — the Analytics
 * filter modal rendered with its corner at the viewport centre and its right
 * half off-screen, so it looked mispositioned and swallowed clicks).
 *
 * Renaming our variables makes the collision impossible instead of trying to
 * win it. This deliberately changes no cascade relationships — layer order and
 * specificity stay exactly as they were — so it carries no restyling risk, and
 * it protects us from any other plugin shipping a Tailwind bundle, not just
 * Yoast. Nothing outside the generated CSS references `--tw-*`.
 */
const namespaceTailwindVars = ( prefix = '--altis-tw-' ) => ( {
	postcssPlugin: 'namespace-tailwind-vars',
	OnceExit( root ) {
		const rename = value => value.replace( /--tw-/g, prefix );

		root.walkDecls( decl => {
			if ( decl.prop.startsWith( '--tw-' ) ) {
				decl.prop = rename( decl.prop );
			}
			if ( decl.value.includes( '--tw-' ) ) {
				decl.value = rename( decl.value );
			}
		} );

		// `@property --tw-*` registrations declare the variables' syntax and
		// initial values; their names have to move too or the registration no
		// longer applies to the renamed variables.
		root.walkAtRules( 'property', atRule => {
			if ( atRule.params.includes( '--tw-' ) ) {
				atRule.params = rename( atRule.params );
			}
		} );
	},
} );

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
		namespaceTailwindVars(),
	],
};

module.exports = config;
