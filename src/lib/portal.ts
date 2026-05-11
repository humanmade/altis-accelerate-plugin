// Get or create a portal container with .tailwind class
export function getPortalContainer() {
	let container = document.getElementById( 'tailwind-portal-root' );
	if ( ! container ) {
		container = document.createElement( 'div' );
		container.id = 'tailwind-portal-root';
		container.className = 'tailwind';
		document.body.appendChild( container );
	}
	return container;
}
