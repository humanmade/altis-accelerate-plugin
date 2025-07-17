import { Tooltip } from '@wordpress/components';
import React from 'react';

import './BreakdownList.css';
import BarList from './BarList';

export interface Item {
	title: string,
	value: number,
	[ k: string ]: any,
}

type ItemProps = Item & {
	total: number,
	showPercent: boolean,
	onSelect?(): void,
};

const formatPercentage = ( value: number ) => ( value < 1 ? '<1' : Math.round( value ) ) + '%';

function Item( props: ItemProps ) {
	const percentage = props.value / props.total * 100;
	return (
		<li
			className="BreakdownList__item"
			role="row"
			style={ {
				// @ts-ignore
				'--breakdownlist-item-width': `${ Math.floor( percentage ) }%`,
			} }
		>
			<Tooltip text={ props.title }>
				{ props.onSelect ? (
					<button
						className="BreakdownList__item-title BreakdownList__item-select"
						role="rowheader"
						type="button"
						onClick={ props.onSelect }
					>
						{ props.title }
					</button>
				) : (
					<span
						className="BreakdownList__item-title"
						role="rowheader"
					>
						{ props.title }
					</span>
				) }
			</Tooltip>
			<span className="BreakdownList__item-value" role="cell">
				{ props.value }
				{ props.showPercent && (
					<>
						{ ' ' }
						({ formatPercentage( percentage ) })
					</>
				) }
			</span>
		</li>
	);
}

export interface Props {
	header?: {
		title: string,
		value: string | number,
	},
	maxItems?: number,
	items: Item[],
	showPercent?: boolean,
	total?: number,
	onSelectItem?( item: Item ): void,
}

export default function BreakdownList( props: Props ) {
	const newItems = props.items.map( item => ( {
		_orig: item,
		name: item.title,
		value: item.value || 0,
	} ) );

	return (
		<>
			{ props.header && (
				<h3 className="font-bold text-gray-900 sm:text-sm">
					{ props.header.title }
				</h3>
			) }
			<BarList
				className="mt-6"
				data={ newItems }
				onValueChange={ props.onSelectItem ? v => props.onSelectItem!( v._orig ) : undefined }
			/>
		</>
	);
}
