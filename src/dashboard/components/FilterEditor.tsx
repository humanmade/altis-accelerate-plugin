import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import React from 'react';
// todo: headlessui?
import Modal from 'react-modal';

import { Duration, Filter, SelectableDate } from '../../utils/admin';
import { defaultAudience } from '../../audiences/data/defaults';
import AudienceEditor from '../../audiences/ui/components/audience-editor';
import FilterAudiencePicker from './FilterAudiencePicker';
import FilterSummary from './FilterSummary';

import './FilterEditor.css';

interface Props {
	nextFilter: Filter,
	showingEditor: boolean,
	onSetShowingEditor( showingEditor: boolean ): void,
	onUpdateNextFilter( filter: Filter ): void,
	onUpdateFilter( filter: Filter ): void,
}
export default function FilterEditor( props: Props ) {
	const {
		nextFilter,
		showingEditor,
		onSetShowingEditor,
		onUpdateNextFilter,
		onUpdateFilter,
	} = props;
	return (
		<Modal
			className="FilterEditor__modal"
			overlayClassName="FilterEditor__modal-overlay"
			portalClassName="FilterEditor__modal-portal"
			isOpen={ showingEditor }
			onRequestClose={ () => onSetShowingEditor( false ) }
		>
			<div className="tailwind">
				<div
					className="w-full h-full transform overflow-hidden ring-0 ring-transparent transition-all data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
				>
					<div className="flex items-stretch justify-between border-b border-b-gray-300 divide-x">
						<div className="text-sm text-gray-900 leading-6 px-3 py-2">
							<FilterSummary
								filter={ nextFilter }
							/>
						</div>
						<div className="shrink-0 flex items-stretch divide-x">
							<button
								className="px-3 text-md text-blue-600 hover:text-blue-800"
								type="button"
								onClick={ () => {
									onUpdateFilter( nextFilter );
									onSetShowingEditor( false );
								} }
							>
								{ __( 'Apply →', 'altis' ) }
							</button>
							<button
								className="px-3 text-md text-blue-600 hover:text-blue-800"
								type="button"
								onClick={ () => {
									onUpdateFilter( { ...nextFilter, audience: defaultAudience } );
									onSetShowingEditor( false );
								} }
							>
								{ __( 'Clear', 'altis' ) }
							</button>
							<button
								className="px-3 text-md text-blue-600 hover:text-blue-800"
								type="button"
								onClick={ () => {
									onUpdateFilter( nextFilter );
									onSetShowingEditor( false );
								} }
							>
								{ __( 'Cancel changes', 'altis' ) }
							</button>
						</div>
					</div>

					<FilterAudiencePicker
						onSelect={ ( audience, audienceId ) => {
							onUpdateFilter( {
								...nextFilter,
								audience,
								audienceId,
							} );
							onSetShowingEditor( false );
						} }
					/>
				</div>
			</div>
			<div className="FilterEditor__audience-wrap">
				<AudienceEditor
					audience={ nextFilter.audience || defaultAudience }
					onChange={ audience => onUpdateNextFilter( { ...nextFilter, audience } ) }
				/>
			</div>
		</Modal>
	);
}
