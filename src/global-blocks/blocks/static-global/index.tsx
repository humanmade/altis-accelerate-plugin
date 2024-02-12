import { Block, BlockConfiguration } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import Image from '../../../accelerate/components/Image';

export const name = 'altis/static-global';

export const options: BlockConfiguration = {
	category: 'common',
	description: __(
		'Create content, and save it for you and other contributors to reuse across your site. This is a placeholder bloc that will be replaced by the Global Blcok when rendered.',
		'altis',
	),
	edit: Edit,
	save: () => null,
	title: __( 'Global Block', 'altis' ),
	supports: {
		customClassName: false,
		html: false,
		reusable: false,
		inserter: false,
	},
	attributes: {
		ref: {
			type: 'number',
		},
	},
};

function Edit(props: Block<{ref: number}>) : JSX.Element {
	const {
		attributes,
	} = props;

	if ( ! attributes.ref ) {
		throw new Error("No ref in static global block.");
	}

	const block = useSelect( ( select ) => {
		return select( 'accelerate' ).getPosts( {
			type: 'wp_block',
			include: attributes.ref,
		}, false );
	}, [ attributes ] )[0];

	return (
		<div className="tailwind">
			{ block ? (
				<div className="flex">
					<div>
						{ block.thumbnail && (
							<Image
								alt={ block.title }
								height={ 47 }
								src={ block.thumbnail }
								width={ 105 }
							/>
						) }
					</div>
					<a className="no-underline text-sm ml-4 font-bold flex-1" href={ block.editUrl || '' } title={ block.title }>
						{ decodeEntities( block.title ) }
					</a>
					<div className="text-sm">
						You can&apos;t edit this block here, instead { ' ' }
						<a href={ block.editUrl || '' }>edit here</a>.
					</div>
				</div>
			) : (
				__( 'Loading...', 'altis' )
			) }

		</div>
	);
}
