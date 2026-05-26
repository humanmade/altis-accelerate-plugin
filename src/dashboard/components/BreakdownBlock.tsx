import React from 'react';

import BreakdownList, { Props as InheritedProps } from './BreakdownList';
import { Card } from './Card';

import './BreakdownBlock.css';

interface Props extends InheritedProps {
	className?: string,
}

export default function BreakdownBlock( props: Props ) {
	return (
		<Card
			className={ props.className || '' }
		>
			<BreakdownList
				{ ...props }
			/>
		</Card>
	);
}

