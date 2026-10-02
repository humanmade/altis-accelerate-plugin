export const duration = {
	instant: 100,
	fast: 150,
	normal: 200,
	slow: 300,
} as const;

export const easing = {
	standard: 'cubic-bezier(0.2, 0, 0, 1)',
	enter: 'cubic-bezier(0, 0, 0, 1)',
	exit: 'cubic-bezier(0.2, 0, 1, 1)',
} as const;

// These compose `easing.standard` above — the same curve the chart's marks
// animate on — so controls and the data they drive share one motion language.
export const transition = {
	colors: 'transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
	opacity: 'transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
	transform: 'transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
	all: 'transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
} as const;
