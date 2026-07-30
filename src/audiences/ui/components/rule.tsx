import { Loader2 } from 'lucide-react';
import React, { Fragment, useState, useRef, useEffect, useMemo } from 'react';

import { useSelect } from '@wordpress/data';
import { sprintf, __ } from '@wordpress/i18n';

import { store } from '../../data';
import { Field } from '../../types';

import SelectOperator from './select-operator';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

type RuleInputProps = {
	disabled: boolean,
	currentField: Field,
	name: string,
	operator: string,
	value: string,
	valuesFailed?: boolean,
	onChange( e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement> ): void,
}

/**
 * Rule input component.
 */
const RuleInput = ( props: RuleInputProps ) => {
	const {
		disabled,
		currentField,
		name,
		operator,
		value,
		valuesFailed,
		onChange,
	} = props;

	// The field value suggestions (currentField.data) are fetched on demand for
	// the selected field. While that request is in flight the value dropdown has
	// no options to offer, so surface a loading state rather than an empty list.
	const isLoadingValues = useSelect(
		select => !! currentField.name
			&& ! ( select( store ) as any ).hasFinishedResolution( 'getFieldData', [ currentField.name ] ),
		[ currentField.name ]
	);

	// Get the currently available values for the field.
	const options = currentField.data?.map( option => ( {
		value: option.value,
		label: ( option.label ? `${ option.label } (${ option.value })` : option.value ) + String( option.percent ? ` ~${ option.percent }%` : '' ),
		count: Number( option?.count ) || 0,
		percent: Number( option?.percent ) || 0,
	} ) ) || [];
	// Sort options by their size/hits.
	const topHits = options.filter( option => option.percent ).slice( 0, 10 );
	topHits.sort( ( a, b ) => b.percent - a.percent );
	// Check if the filter doesn't allow free text.
	const allowFreeText = ! currentField?.options?.disable_free_text;

	// Get input refs to manage focus.
	const inputEl = useRef<HTMLInputElement>( null );

	// Default to display of the dropdown if the value is in existing data or empty.
	const defaultDropdownState = value === '' || !! options.find( option => option.value === value );
	const [ showDropdown, setShowDropdown ] = useState( defaultDropdownState );
	useEffect( () => {
		if ( ! showDropdown ) {
			inputEl && inputEl.current && inputEl.current.focus();
		}
	}, [ showDropdown ] );

	// Set intial dropdown state and update if the field has changed.
	const [ prevField, setPrevField ] = useState<string | null>( null );
	if ( currentField.name !== prevField ) {
		setShowDropdown( defaultDropdownState );
		setPrevField( currentField.name );
	}

	// The initial dropdown-vs-text choice is made while the on-demand value
	// data is still loading (options is empty then, forcing text mode for any
	// saved value). Once the data lands, switch back to the dropdown if it
	// contains the current value — but never force a user out of an explicitly
	// chosen free-text mode with an unrecognized value.
	useEffect( () => {
		if ( ! isLoadingValues && ! showDropdown && value !== '' && options.some( option => option.value === value ) ) {
			setShowDropdown( true );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-evaluate only when loading completes.
	}, [ isLoadingValues ] );

	// Placeholder for empty value (Radix Select doesn't allow empty string values)
	const EMPTY_VALUE = '__empty__';

	// Create a synthetic event to maintain compatibility with existing handlers
	const handleValueChange = ( newValue: string ) => {
		if ( newValue === '___' ) {
			setShowDropdown( false );
		} else {
			// Convert placeholder back to empty string
			const actualValue = newValue === EMPTY_VALUE ? '' : newValue;
			onChange( {
				target: { value: actualValue },
			} as React.ChangeEvent<HTMLSelectElement> );
		}
	};

	// Convert empty value to placeholder for Select component
	const selectValue = value === '' ? EMPTY_VALUE : value;

	switch ( currentField.type ) {
		case 'number':
			return (
				<Input
					className="flex-1"
					disabled={ disabled }
					name={ name }
					placeholder={ `${ sprintf(
						__( 'Avg: %d, Lowest: %d, Highest: %d', 'altis' ),
						Number( currentField.stats.avg ).toFixed( 2 ),
						Number( currentField.stats.min ).toFixed( 2 ),
						Number( currentField.stats.max ).toFixed( 2 )
					) }` }
					type="number"
					value={ value }
					onChange={ onChange }
				/>
			);

		case 'string':
		default:
			switch ( operator ) {
				case '=':
				case '!=':
				case '*=':
				case '!*':
				case '^=':
					return (
						<Fragment>
							{ ! showDropdown && (
								<div className="flex flex-1 items-center">
									<Input
										ref={ inputEl }
										className="flex-1"
										disabled={ disabled }
										list={ `audience-editor__rule__data_${ name }` }
										name={ name }
										type="text"
										value={ value }
										onBlur={ () => {
											// If the value is empty or in the field data convert back to dropdown on blur.
											setShowDropdown( defaultDropdownState );
										} }
										onChange={ onChange }
									/>
									<Button
										className="text-destructive -ml-8"
										size="sm"
										variant="link"
										onClick={ () => {
											onChange( { target: { value: '' } } as React.ChangeEvent<HTMLInputElement> );
											setShowDropdown( true );
										} }
									>
										&times;
									</Button>
								</div>
							) }
							{ showDropdown && (
								<Select
									disabled={ disabled }
									value={ selectValue }
									onValueChange={ handleValueChange }
								>
									<SelectTrigger className="flex-1" data-testid="rule-value-select">
										<SelectValue placeholder={ __( 'Select a value', 'altis' ) } />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ EMPTY_VALUE }>{ __( 'Empty', 'altis' ) }</SelectItem>
										{ isLoadingValues && options.length === 0 && (
											<div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
												<Loader2 className="h-4 w-4 animate-spin" />
												{ __( 'Loading values…', 'altis' ) }
											</div>
										) }
										{ ! isLoadingValues && valuesFailed && options.length === 0 && (
											<div className="px-2 py-1.5 text-sm text-muted-foreground">
												{ __( 'Values couldn’t be loaded — choose "Other" to type one.', 'altis' ) }
											</div>
										) }
										{ topHits.length > 0 && (
											<SelectGroup>
												<SelectLabel>{ __( 'Top hits', 'altis' ) }</SelectLabel>
												{ topHits.map( option => option.value !== '' && (
													<SelectItem
														key={ `top-${ option.value }` }
														value={ option.value }
													>
														{ option.label }
													</SelectItem>
												) ) }
											</SelectGroup>
										) }
										<SelectGroup>
											<SelectLabel>{ __( 'All values', 'altis' ) }</SelectLabel>
											{ options
												.filter( option => ! topHits.some( th => th.value === option.value ) )
												.map( option => option.value !== '' && (
													<SelectItem
														key={ option.value }
														value={ option.value }
													>
														{ option.label }
													</SelectItem>
												) ) }
										</SelectGroup>
										{ allowFreeText && (
											<SelectItem value="___">{ __( 'Other, please specify...', 'altis' ) }</SelectItem>
										) }
									</SelectContent>
								</Select>
							) }
						</Fragment>
					);

				default:
					return null;
			}
	}
};

interface Props {
	canRemove: boolean,
	field: string,
	namePrefix: string,
	operator: string,
	readOnly?: boolean,
	value: string,
	onChange( e: { field?: string, operator?: string, value?: string } ): void,
	onRemove(): void,
}

const DEFAULT_FIELD : Field = {
	label: '',
	name: '',
	type: 'string',
	data: [],
	options: {},
	stats: undefined,
};

/**
 * The rule editor input component.
 */
export default function Rule( props: Props ) {
	const {
		canRemove,
		field,
		namePrefix,
		operator,
		readOnly,
		value,
		onChange,
		onRemove,
	} = props;

	const fields = useSelect( select => select( store ).getFields(), [] );
	const definition = useMemo( () => {
		return fields.find( fieldData => fieldData.name === field );
	}, [ fields, field ] );

	// Fetch this field's value data (top values / stats) on demand — only the
	// selected field is queried from ClickHouse, when it's actually chosen.
	// Prefer the enriched result (with data/stats) once it lands, falling back
	// to the basic definition so the operator/value controls render immediately.
	const fieldData = useSelect(
		select => field ? select( store ).getFieldData( field ) : undefined,
		[ field ]
	);
	// An errored fieldData entry means the value fetch failed — fall back to
	// the basic definition so the controls still render (with free text).
	const currentField = ( fieldData && ! fieldData.error ) ? fieldData : definition;

	const persistentFields = fields.filter( fieldData => fieldData.name.match( /^endpoint\./ ) );
	const pointInTimeFields = fields.filter( fieldData => ! fieldData.name.match( /^endpoint\./ ) );

	// Create a synthetic event to maintain compatibility with existing handlers
	const handleFieldChange = ( newValue: string ) => {
		onChange( {
			field: newValue,
			value: '',
		} );
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Select
				disabled={ readOnly || fields.length === 0 }
				value={ field }
				onValueChange={ handleFieldChange }
			>
				<SelectTrigger className="w-[200px]" data-testid="rule-field-select">
					<SelectValue placeholder={ __( 'Select a field', 'altis' ) } />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>{ __( 'Visitor — persists across visits', 'altis' ) }</SelectLabel>
						{ persistentFields.map( fieldData => (
							<SelectItem
								key={ fieldData.name }
								value={ fieldData.name }
							>
								{ fieldData.label }
							</SelectItem>
						) ) }
					</SelectGroup>
					<SelectGroup>
						<SelectLabel>{ __( 'Current moment — at view time', 'altis' ) }</SelectLabel>
						{ pointInTimeFields.map( fieldData => (
							<SelectItem
								key={ fieldData.name }
								value={ fieldData.name }
							>
								{ fieldData.label }
							</SelectItem>
						) ) }
					</SelectGroup>
				</SelectContent>
			</Select>

			<SelectOperator
				className="w-[140px]"
				disabled={ readOnly || fields.length === 0 }
				name={ `${ namePrefix }[operator]` }
				type={ currentField?.type || 'string' }
				value={ operator }
				onChange={ e => onChange( { operator: e.target.value } ) }
			/>

			<RuleInput
				currentField={ currentField || DEFAULT_FIELD }
				disabled={ readOnly || fields.length === 0 }
				name={ `${ namePrefix }[value]` }
				operator={ operator }
				value={ value }
				valuesFailed={ !! fieldData?.error }
				onChange={ e => onChange( { value: e.target.value } ) }
			/>

			{ canRemove && (
				<Button
					className="text-destructive"
					size="sm"
					variant="link"
					onClick={ onRemove }
				>
					{ __( 'Remove', 'altis' ) }
				</Button>
			) }

			{ currentField?.options?.description && (
				<p className="w-full mt-2 text-sm text-muted-foreground">
					{ currentField.options.description }
				</p>
			) }
		</div>
	);
}
