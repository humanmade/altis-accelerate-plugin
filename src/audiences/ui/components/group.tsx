import React, { Component } from 'react';

import { __ } from '@wordpress/i18n';

import { defaultRule } from '../../data/defaults';
import { Group as TGroup, Rule as TRule } from '../../types';

import Rule from './rule';
import SelectInclude from './select-include';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props extends TGroup {
	/**
	 * Whether the group can be removed.
	 */
	canRemove?: boolean;

	/**
	 * Name prefix for form fields.
	 */
	namePrefix: string;

	/**
	 * Whether the group is in read-only mode.
	 */
	readOnly?: boolean;

	/**
	 * Title for the group.
	 */
	title?: string;

	/**
	 * Change handler.
	 *
	 * @param {Object} group Updated group object.
	 */
	onChange: ( group: Partial<TGroup> ) => void;

	/**
	 * Remove handler.
	 */
	onRemove: () => void;
}

/**
 * Rule Group editor component.
 */
export default class Group extends Component<Props> {
	/**
	 * New rule handler.
	 */
	onAddRule = () => {
		this.props.onChange( {
			rules: [
				...this.props.rules || [],
				defaultRule,
			],
		} );
	};

	/**
	 * Rule update handler.
	 *
	 * @param {Event} e Change event for rule input.
	 */
	onChangeRule = ( e: React.ChangeEvent<HTMLSelectElement> ) => {
		this.props.onChange( {
			include: e.target.value as 'all' | 'any',
		} );
	};

	/**
	 * Remove rule handler.
	 *
	 * @param {number} id Rule index to remove.
	 */
	onRemoveRule = ( id: number ) => {
		const { rules } = this.props;
		if ( ! rules ) {
			return;
		}
		this.props.onChange( {
			rules: [
				...rules.slice( 0, id ),
				...rules.slice( id + 1 ),
			],
		} );
	};

	/**
	 * Update rule handler.
	 *
	 * @param {number} ruleId Rule index.
	 * @param {Object} rule Rule config object.
	 */
	updateRule = ( ruleId: number, rule: { field?: string, operator?: string, value?: string } ) => {
		const { rules } = this.props;
		if ( ! rules ) {
			return;
		}
		this.props.onChange( {
			rules: [
				...rules.slice( 0, ruleId ),
				{
					...rules[ ruleId ],
					...rule,
				} as TRule,
				...rules.slice( ruleId + 1 ),
			],
		} );
	};

	render() {
		const {
			canRemove,
			include,
			namePrefix,
			readOnly,
			rules,
			title,
			onRemove,
		} = this.props;

		return (
			<Card className="mb-5">
				<CardHeader className="pb-3">
					<div className="flex items-baseline gap-4">
						{ title && (
							<CardTitle className="text-sm lowercase font-medium">{ title }</CardTitle>
						) }
						<SelectInclude
							label={ __( 'rules', 'altis' ) }
							name={ `${ namePrefix }[include]` }
							readOnly={ readOnly }
							value={ include }
							onChange={ this.onChangeRule }
						/>
					</div>
				</CardHeader>

				<CardContent className="space-y-4">
					{ rules?.map( ( rule, ruleId ) => (
						<Rule
							key={ ruleId }
							canRemove={ ! readOnly && rules.length > 1 }
							field={ rule.field }
							namePrefix={ `${ namePrefix }[rules][${ ruleId }]` }
							operator={ rule.operator }
							readOnly={ readOnly }
							value={ rule.value }
							onChange={ rule => this.updateRule( ruleId, rule ) }
							onRemove={ () => this.onRemoveRule( ruleId ) }
						/>
					) ) }
				</CardContent>

				{ ! readOnly && (
					<CardFooter className="gap-2">
						<Button
							size="sm"
							variant="secondary"
							onClick={ this.onAddRule }
						>
							{ __( 'Add a rule', 'altis' ) }
						</Button>

						{ canRemove && (
							<Button
								className="text-destructive"
								size="sm"
								variant="link"
								onClick={ onRemove }
							>
								{ __( 'Remove group', 'altis' ) }
							</Button>
						) }
					</CardFooter>
				) }
			</Card>
		);
	}
}
