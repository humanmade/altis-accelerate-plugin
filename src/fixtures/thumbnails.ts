const makeThumbnail = ( emoji: string, stops: [ string, string, string ] ): string => {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">'
		+ '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
		+ `<stop offset="0%" stop-color="${ stops[ 0 ] }"/>`
		+ `<stop offset="55%" stop-color="${ stops[ 1 ] }"/>`
		+ `<stop offset="100%" stop-color="${ stops[ 2 ] }"/>`
		+ '</linearGradient></defs>'
		+ '<rect width="400" height="300" fill="url(#g)"/>'
		+ `<text x="200" y="128" dominant-baseline="middle" text-anchor="middle" font-size="130">${ emoji }</text>`
		+ '<rect x="0" y="252" width="400" height="48" fill="rgba(0,0,0,0.2)"/>'
		+ '</svg>';

	return `data:image/svg+xml,${ encodeURIComponent( svg ) }`;
};

export const saladThumbnail = makeThumbnail( '🥗', [ '#3f6b35', '#7fa650', '#c5d86d' ] );
export const tomatoThumbnail = makeThumbnail( '🍅', [ '#7a1f1f', '#c0392b', '#e6704f' ] );
export const lemonThumbnail = makeThumbnail( '🍋', [ '#d9a441', '#f4d35e', '#a3b18a' ] );
export const sandwichThumbnail = makeThumbnail( '🥪', [ '#7a4a24', '#d98e34', '#f2b660' ] );
export const cakeThumbnail = makeThumbnail( '🍰', [ '#7b2d5e', '#c2477a', '#f2a6c1' ] );
export const strawberryThumbnail = makeThumbnail( '🍓', [ '#8e1f3b', '#d1495b', '#f4a6a0' ] );
export const noodleThumbnail = makeThumbnail( '🍜', [ '#a8391e', '#e07a3f', '#f4c95d' ] );
export const pieThumbnail = makeThumbnail( '🥧', [ '#7a4a1f', '#c98a3e', '#f0c987' ] );
export const breadThumbnail = makeThumbnail( '🍞', [ '#6b4423', '#a9713f', '#e0b878' ] );
export const coffeeThumbnail = makeThumbnail( '☕', [ '#3b2418', '#6f4a2f', '#b98657' ] );
