// Get or create a portal container with .tailwind class.
//
// The container establishes its own stacking context above the legacy audience
// manager modal (`.media-modal`, z-index 1000002 — see src/components/modal.tsx).
// Without this, shadcn dropdowns/popovers/selects (which portal in here) render
// *behind* that modal and can't be interacted with — e.g. the audience rule
// field dropdowns when editing an audience inside the picker modal.
export function getPortalContainer() {
	let container = document.getElementById( 'tailwind-portal-root' );
	if ( ! container ) {
		container = document.createElement( 'div' );
		container.id = 'tailwind-portal-root';
		container.className = 'tailwind';
		container.style.position = 'relative';
		container.style.zIndex = '1000003';
		document.body.appendChild( container );
	}
	// Self-heal: re-assert class and inline styles on reuse, in case this root
	// was created by an older bundle that didn't set them.
	if ( ! container.className.includes( 'tailwind' ) ) {
		container.className = 'tailwind';
	}
	container.style.position = 'relative';
	container.style.zIndex = '1000003';
	return container;
}
