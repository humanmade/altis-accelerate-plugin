import React, { useState, useEffect } from 'react';

import { __ } from '@wordpress/i18n';

import { defaultAudience } from '../../audiences/data/defaults';
import { Audience } from '../../audiences/types';
import AudienceEditor from '../../audiences/ui/components/audience-editor';
import { Filter } from '../../utils/admin';

import FilterAudiencePicker, { SelectionMode } from './FilterAudiencePicker';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Props {
	nextFilter: Filter,
	showingEditor: boolean,
	onSetShowingEditor( showingEditor: boolean ): void,
	onUpdateNextFilter( filter: Filter ): void,
	onUpdateFilter( filter: Filter ): void,
}

// Determine initial selection mode from filter state
function getInitialMode( filter: Filter ): SelectionMode {
	if ( filter.audienceId && filter.audienceId > 0 ) {
		return 'audience';
	}
	if ( filter.audience && filter.audience.groups && filter.audience.groups.length > 0 ) {
		return 'custom';
	}
	return 'all';
}

export default function FilterEditor( props: Props ) {
	const {
		nextFilter,
		showingEditor,
		onSetShowingEditor,
		onUpdateNextFilter,
		onUpdateFilter,
	} = props;

	// Track selection mode: 'all' (no filter), 'audience' (named audience), 'custom' (editable rules)
	const [ selectionMode, setSelectionMode ] = useState<SelectionMode>( () => getInitialMode( nextFilter ) );
	const [ selectedAudienceId, setSelectedAudienceId ] = useState<number | undefined>( nextFilter.audienceId );
	const [ selectedAudienceName, setSelectedAudienceName ] = useState<string>( '' );
	const [ customAudience, setCustomAudience ] = useState<Audience>( nextFilter.audience || defaultAudience );

	// Reset state when modal opens
	useEffect( () => {
		if ( showingEditor ) {
			setSelectionMode( getInitialMode( nextFilter ) );
			setSelectedAudienceId( nextFilter.audienceId );
			setCustomAudience( nextFilter.audience || defaultAudience );
		}
	}, [ showingEditor, nextFilter ] );

	// Handle "All Traffic" selection
	const handleSelectAllTraffic = () => {
		setSelectionMode( 'all' );
		setSelectedAudienceId( undefined );
		setSelectedAudienceName( '' );
	};

	// Handle named audience selection
	const handleSelectAudience = ( audience: Audience, id: number, title: string ) => {
		setSelectionMode( 'audience' );
		setSelectedAudienceId( id );
		setSelectedAudienceName( title );
		setCustomAudience( audience );
	};

	// Handle custom filter selection - transfer current audience rules to editable state
	const handleSelectCustomFilter = () => {
		setSelectionMode( 'custom' );
		setSelectedAudienceId( undefined );
		setSelectedAudienceName( '' );
		// Keep the current customAudience so rules transfer over
	};

	// Handle custom audience changes
	const handleCustomAudienceChange = ( audience: Audience ) => {
		setCustomAudience( audience );
	};

	// Handle Apply
	const handleApply = () => {
		let newFilter: Filter;

		switch ( selectionMode ) {
			case 'all':
				newFilter = {};
				break;
			case 'audience':
				newFilter = {
					...nextFilter,
					audience: customAudience,
					audienceId: selectedAudienceId,
					audienceName: selectedAudienceName,
				};
				break;
			case 'custom':
				newFilter = {
					...nextFilter,
					audience: customAudience,
					audienceId: undefined,
					audienceName: undefined,
				};
				break;
			default:
				newFilter = {};
		}

		onUpdateFilter( newFilter );
		onSetShowingEditor( false );
	};

	// Handle Reset to All Traffic
	const handleReset = () => {
		handleSelectAllTraffic();
	};

	// Check if filter is active (not "All Traffic")
	const hasActiveFilter = selectionMode !== 'all';

	// Get header subtitle based on selection mode
	const getHeaderSubtitle = () => {
		switch ( selectionMode ) {
			case 'audience':
				return selectedAudienceName || __( 'Named audience selected', 'altis' );
			case 'custom':
				return __( 'Custom Filter', 'altis' );
			default:
				return __( 'All Traffic', 'altis' );
		}
	};

	return (
		<Dialog open={ showingEditor } onOpenChange={ onSetShowingEditor }>
			<DialogContent className="sm:max-w-[1200px] w-[90vw] max-h-[90vh] overflow-y-auto p-0" hideCloseButton>
				{ /* Header */ }
				<div className="flex h-14 items-center justify-between border-b border-border px-4 bg-muted rounded-t-lg">
					<div className="flex items-center gap-3">
						<span className="font-semibold">
							{ __( 'Filter by Audience', 'altis' ) }
						</span>
						<Separator className="h-5" orientation="vertical" />
						<span className="text-sm text-muted-foreground">
							{ getHeaderSubtitle() }
						</span>
					</div>
					<div className="flex items-center gap-2">
						{ hasActiveFilter && (
							<Button
								size="sm"
								type="button"
								variant="ghost"
								onClick={ handleReset }
							>
								{ __( 'Reset to All Traffic', 'altis' ) }
							</Button>
						) }
						<DialogClose asChild>
							<Button
								size="sm"
								type="button"
								variant="outline"
							>
								{ __( 'Cancel', 'altis' ) }
							</Button>
						</DialogClose>
						<Button
							size="sm"
							type="button"
							onClick={ handleApply }
						>
							{ __( 'Apply', 'altis' ) }
						</Button>
					</div>
				</div>

				{ /* Audience picker list */ }
				<FilterAudiencePicker
					selectedAudienceId={ selectedAudienceId }
					selectedMode={ selectionMode }
					onSelectAllTraffic={ handleSelectAllTraffic }
					onSelectAudience={ handleSelectAudience }
					onSelectCustomFilter={ handleSelectCustomFilter }
				/>

				{ /* Audience rules display/editor */ }
				{ selectionMode !== 'all' && (
					<div className="mx-3 border-t border-border pt-4 pb-4">
						<h3 className="text-sm font-medium mb-3">
							{ selectionMode === 'audience'
								? __( 'Audience rules (read-only)', 'altis' )
								: __( 'Custom filter rules', 'altis' ) }
						</h3>
						<AudienceEditor
							audience={ customAudience }
							readOnly={ selectionMode === 'audience' }
							onChange={ handleCustomAudienceChange }
						/>
					</div>
				) }
			</DialogContent>
		</Dialog>
	);
}
