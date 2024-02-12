import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import BlockSelectorList from './BlockSelectorList';
import Search from '../../components/Search';
import { Post } from '../../utils/admin';
import { useSelect } from '@wordpress/data';

type Props = {
	value: number[],
	onChange: ( blocks: number[] ) => void,
	placeholder?: string,
}

export default function BlockSelector( props: Props ) {
	const {
		value: blockIds,
		onChange,
		placeholder = __( 'Search blocks', 'altis' ),
	} = props;

	const [ search, setSearch ] = useState<string>( '' );

	const blocks = useSelect<Post[]>( select => {
		const args: {
			search?: string,
			include?: number[],
		} = {};

		if ( search.length > 0 ) {
			args.search = search;
		} else {
			args.include = blockIds;
		}

		return select( 'accelerate' ).getPosts( {
			type: 'wp_block',
			...args,
		}, false );
	}, [ search ] );

	return (
		<div>
			<div style={ { marginBottom: '20px' } }>
				<Search
					label={ __( 'Search blocks', 'altis' ) }
					placeholder={ placeholder }
					value={ search }
					onChange={ e => setSearch( e.target.value ) }
				/>
			</div>

			<BlockSelectorList
				blocks={ blocks }
				selected={ blockIds }
				onChange={ onChange }
			/>
		</div>
	);
}
