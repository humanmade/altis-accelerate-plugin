import React from 'react';

import Block from './Block';
import BreakdownList, { Props as InheritedProps } from './BreakdownList';

import './BreakdownBlock.css';

interface Props extends InheritedProps {
	className?: string,
}

export default function BreakdownBlock( props: Props ) {
	return (
		<Block
			className={ [
				props.className || '',
			].join( ' ' ) }
		>
			<BreakdownList
				{ ...props }
			/>
		</Block>
	);
}

