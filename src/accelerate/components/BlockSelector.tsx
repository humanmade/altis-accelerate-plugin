import { Search } from 'lucide-react';

import { useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { Post } from '../../utils/admin';

import BlockSelectorList from './BlockSelectorList';

import { Input } from '@/components/ui/input';

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
		} = {};

		if ( search.length > 0 ) {
			args.search = search;
		}

		return select( 'accelerate' ).getPosts( {
			type: 'wp_block',
			...args,
		}, false );
	}, [ search ] );

	return (
		<div className="accelerate__block-selector">
			<div className="tailwind mb-5">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						className="pl-9"
						placeholder={ placeholder }
						value={ search }
						onChange={ e => setSearch( e.target.value ) }
					/>
				</div>
			</div>

			<BlockSelectorList
				blocks={ blocks }
				selected={ blockIds }
				onChange={ onChange }
			/>
		</div>
	);
}
