import apiFetch from '@wordpress/api-fetch';
import { InnerBlocks } from '@wordpress/block-editor';
// @ts-expect-error @wordpress/block-library is installed for Storybook, but this package version ships no declarations.
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockType, registerBlockType } from '@wordpress/blocks';
import { Icon as WordPressIcon } from '@wordpress/components';
import * as compose from '@wordpress/compose';
import * as data from '@wordpress/data';
import * as element from '@wordpress/element';
import * as hooks from '@wordpress/hooks';
import * as i18n from '@wordpress/i18n';
import {
	chartBar,
	chevronDown,
	close,
	external,
	image,
	paragraph,
	textColor,
	warning,
} from '@wordpress/icons';

type MediaFrame = {
	on: ( event: string, callback: () => void ) => MediaFrame,
	open: () => MediaFrame,
	state: () => {
		get: () => {
			first: () => {
				toJSON: () => { id: number },
			},
		},
	},
};

const createMediaFrame = (): MediaFrame => {
	const callbacks: Record<string, () => void> = {};
	const frame: MediaFrame = {
		on: ( event, callback ) => {
			callbacks[ event ] = callback;
			return frame;
		},
		open: () => {
			callbacks.select?.();
			return frame;
		},
		state: () => ( {
			get: () => ( {
				first: () => ( {
					toJSON: () => ( { id: 9001 } ),
				} ),
			} ),
		} ),
	};
	return frame;
};

const globalWithWp = globalThis as typeof globalThis & {
	wp?: Record<string, unknown>,
};

type FallbackBlockEditProps = {
	attributes: Record<string, any>,
	className?: string,
};

const existingBlockLibrary = globalWithWp.wp?.blockLibrary as Record<string, unknown> | undefined;

type WordPressIconType = NonNullable<Parameters<typeof WordPressIcon>[0]['icon']>;

const iconGlyphs: Record<string, WordPressIconType> = {
	'arrow-down-alt2': chevronDown,
	'chart-line': chartBar,
	'editor-textcolor': textColor,
	'external': external,
	'format-image': image,
	'no-alt': close,
	'text': paragraph,
	'warning': warning,
};

const fallbackIconLabels: Record<string, string> = {
	'arrow-down-alt2': 'v',
	'chart-line': '~',
	'editor-textcolor': 'T',
	'external': 'o',
	'format-image': 'i',
	'no-alt': 'x',
	'text': 'T',
	'warning': '!',
};

const joinClassNames = ( ...classNames: Array<string | undefined | false> ) => classNames.filter( Boolean ).join( ' ' );

const createRawHtmlElement = (
	tagName: string,
	props: Record<string, unknown>,
	html?: string
) => element.createElement( tagName, {
	...props,
	dangerouslySetInnerHTML: {
		__html: html || '',
	},
} );

const registerFallbackBlock = ( name: string, settings: Record<string, unknown> ) => {
	if ( getBlockType( name ) ) {
		return;
	}

	registerBlockType( name, settings as any );
};

export const registerStorybookCoreFallbacks = () => {
	const renderParagraph = ( { attributes, className }: FallbackBlockEditProps ) => createRawHtmlElement(
		'p',
		{
			className,
		},
		attributes.content
	);
	const renderHeading = ( { attributes, className }: FallbackBlockEditProps ) => {
		const level = [ 1, 2, 3, 4, 5, 6 ].includes( attributes.level ) ? attributes.level : 2;
		return createRawHtmlElement(
			`h${ level }`,
			{
				className: joinClassNames( 'wp-block-heading', className ),
			},
			attributes.content
		);
	};
	const renderImage = ( { attributes, className }: FallbackBlockEditProps ) => element.createElement(
		'figure',
		{
			className: joinClassNames(
				'wp-block-image',
				attributes.sizeSlug ? `size-${ attributes.sizeSlug }` : undefined,
				className
			),
		},
		element.createElement( 'img', {
			alt: attributes.alt || '',
			height: attributes.height,
			src: attributes.url,
			width: attributes.width,
		} ),
		attributes.caption ? createRawHtmlElement( 'figcaption', {}, attributes.caption ) : null
	);
	const renderButton = ( { attributes, className }: FallbackBlockEditProps ) => {
		const tagName = attributes.tagName === 'button' ? 'button' : 'a';
		return element.createElement(
			'div',
			{
				className: joinClassNames( 'wp-block-button', className ),
			},
			createRawHtmlElement(
				tagName,
				{
					className: 'wp-block-button__link',
					href: tagName === 'a' ? attributes.url : undefined,
					rel: attributes.rel,
					target: attributes.linkTarget,
					type: tagName === 'button' ? attributes.type || 'button' : undefined,
				},
				attributes.text
			)
		);
	};

	registerFallbackBlock( 'core/paragraph', {
		apiVersion: 3,
		title: 'Paragraph',
		category: 'text',
		attributes: {
			content: {
				type: 'string',
				source: 'html',
				selector: 'p',
			},
			dropCap: {
				type: 'boolean',
				default: false,
			},
		},
		edit: renderParagraph,
		save: renderParagraph,
	} );

	registerFallbackBlock( 'core/heading', {
		apiVersion: 3,
		title: 'Heading',
		category: 'text',
		attributes: {
			content: {
				type: 'string',
				source: 'html',
				selector: 'h1,h2,h3,h4,h5,h6',
			},
			level: {
				type: 'number',
				default: 2,
			},
		},
		edit: renderHeading,
		save: renderHeading,
	} );

	registerFallbackBlock( 'core/image', {
		apiVersion: 3,
		title: 'Image',
		category: 'media',
		attributes: {
			url: {
				type: 'string',
				source: 'attribute',
				selector: 'img',
				attribute: 'src',
			},
			alt: {
				type: 'string',
				source: 'attribute',
				selector: 'img',
				attribute: 'alt',
				default: '',
			},
			caption: {
				type: 'string',
				source: 'html',
				selector: 'figcaption',
			},
			id: {
				type: 'number',
			},
			width: {
				type: 'string',
			},
			height: {
				type: 'string',
			},
			sizeSlug: {
				type: 'string',
			},
		},
		edit: renderImage,
		save: renderImage,
	} );

	registerFallbackBlock( 'core/buttons', {
		apiVersion: 3,
		title: 'Buttons',
		category: 'design',
		edit: ( { className }: FallbackBlockEditProps ) => element.createElement(
			'div',
			{
				className: joinClassNames( 'wp-block-buttons', className ),
			},
			element.createElement( InnerBlocks )
		),
		save: () => element.createElement(
			'div',
			{
				className: 'wp-block-buttons',
			},
			element.createElement( InnerBlocks.Content )
		),
	} );

	registerFallbackBlock( 'core/button', {
		apiVersion: 3,
		title: 'Button',
		category: 'design',
		parent: [ 'core/buttons' ],
		attributes: {
			tagName: {
				type: 'string',
				default: 'a',
			},
			type: {
				type: 'string',
				default: 'button',
			},
			url: {
				type: 'string',
				source: 'attribute',
				selector: 'a',
				attribute: 'href',
			},
			text: {
				type: 'string',
				source: 'html',
				selector: 'a,button',
			},
			linkTarget: {
				type: 'string',
				source: 'attribute',
				selector: 'a',
				attribute: 'target',
			},
			rel: {
				type: 'string',
				source: 'attribute',
				selector: 'a',
				attribute: 'rel',
			},
		},
		edit: renderButton,
		save: renderButton,
	} );
};

const components = {
	Icon: ( { className, icon, size = 20 }: { className?: string, icon?: unknown, size?: number } ) => {
		const resolvedIcon = typeof icon === 'string' ? iconGlyphs[ icon ] || icon : icon;

		if ( typeof resolvedIcon !== 'string' ) {
			return element.createElement( WordPressIcon, {
				'aria-hidden': true,
				className,
				icon: resolvedIcon as WordPressIconType,
				size,
			} );
		}

		return element.createElement(
			'span',
			{
				'aria-hidden': true,
				className,
				style: {
					alignItems: 'center',
					display: 'inline-flex',
					fontSize: Math.min( size, 12 ),
					height: size,
					justifyContent: 'center',
					lineHeight: 1,
					overflow: 'hidden',
					width: size,
				},
			},
			fallbackIconLabels[ resolvedIcon ] || resolvedIcon.slice( 0, 1 )
		);
	},
};

globalWithWp.wp = {
	...( globalWithWp.wp || {} ),
	apiFetch,
	blocks: {
		getBlockType,
		registerBlockType,
	},
	blockLibrary: {
		...existingBlockLibrary,
		registerStorybookCoreFallbacks,
		registerCoreBlocks,
	},
	components,
	compose,
	data,
	element,
	hooks,
	i18n,
	media: globalWithWp.wp?.media || createMediaFrame,
};

registerStorybookCoreFallbacks();
