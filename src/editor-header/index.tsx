import { useState, useEffect } from 'react';

import { useSelect } from '@wordpress/data';
import { createPortal } from '@wordpress/element';

import { HeaderRow, VerticalDivider } from '../accelerate/components/shared/HeaderRow';
import { Period } from '../accelerate/components/shared/PeriodChips';
import { ViewsMetric } from '../accelerate/components/shared/ViewsMetric';
import { AnimatedTabs } from '../components/ui/animated-tabs';
import { Switch } from '../components/ui/switch';
import { useCurrentPostId, useCurrentPostType, useEditorPortal, usePersistentState } from '../data/hooks';
import { store } from '../data/index';

import { ExperimentChips } from './components/ExperimentChips';
import { ExperimentTray } from './components/ExperimentTray';
import { HudOverlays } from './components/HudOverlays';

const PERIOD_OPTIONS = [
	{
		value: 'P7D' as const,
		label: '7D',
	},
	{
		value: 'P30D' as const,
		label: '30D',
	},
	{
		value: 'P90D' as const,
		label: '90D',
	},
];

interface HeaderBarProps {
	hudEnabled: boolean;
	setHudEnabled: ( enabled: boolean ) => void;
	expandedTestId: string | null;
	setExpandedTestId: ( testId: string | null ) => void;
}

const HeaderBar = ( { hudEnabled, setHudEnabled, expandedTestId, setExpandedTestId }: HeaderBarProps ) => {
	const postId = useCurrentPostId();
	const postType = useCurrentPostType();

	const [ period, setPeriod ] = useState<Period>( 'P7D' );

	const histogram = useSelect(
		select => {
			if ( ! postId ) return null;
			const args: Record<string, unknown> = {
				ids: [ postId ],
				period,
			};
			return select( store ).getDiffs( args );
		},
		[ postId, period ]
	);

	const current = histogram?.[ postId as number ]?.current;
	const isLoading = useSelect( select => select( store ).getIsLoadingDiffs(), [] );

	if ( ! postId || ! postType ) return null;

	return (
		<HeaderRow>
			<AnimatedTabs
				options={ PERIOD_OPTIONS }
				value={ period }
				onValueChange={ setPeriod }
			/>
			<VerticalDivider />
			<ViewsMetric
				histogram={ current?.by_date || [] }
				loading={ Boolean( isLoading ) }
				period={ period }
				views={ current?.views || 0 }
			/>
			<VerticalDivider />
			<ExperimentChips
				expandedTestId={ expandedTestId }
				onToggle={ setExpandedTestId }
			/>
			<div className="flex items-center gap-2 ml-auto">
				<span className="!text-sm !font-medium text-gray-500">HUD</span>
				<kbd className="!text-xs !font-normal text-gray-400 !bg-white px-1.5 py-0.5 rounded" style={ { fontFamily: 'ui-monospace, monospace' } }>⌘J</kbd>
				<Switch checked={ hudEnabled } onCheckedChange={ setHudEnabled } />
			</div>
		</HeaderRow>
	);
};

const Portal = () => {
	const postType = useCurrentPostType();
	const { portalNode, container } = useEditorPortal( postType );
	const [ hudEnabled, setHudEnabled ] = usePersistentState<boolean>( 'hud-enabled', false );
	const [ expandedTestId, setExpandedTestId ] = useState<string | null>( null );

	// CMD+J keyboard shortcut to toggle HUD
	useEffect( () => {
		const handleKeyDown = ( e: KeyboardEvent ) => {
			if ( ( e.metaKey || e.ctrlKey ) && e.key === 'j' ) {
				e.preventDefault();
				setHudEnabled( ! hudEnabled );
			}
		};

		document.addEventListener( 'keydown', handleKeyDown );
		return () => document.removeEventListener( 'keydown', handleKeyDown );
	}, [ hudEnabled, setHudEnabled ] );

	if ( ! postType || ! [ 'post', 'page' ].includes( postType ) ) return null;
	if ( ! container ) return null;

	return (
		<>
			{ createPortal(
				<div className="tailwind" style={ { width: '100%' } }>
					<HeaderBar
						expandedTestId={ expandedTestId }
						hudEnabled={ hudEnabled }
						setExpandedTestId={ setExpandedTestId }
						setHudEnabled={ setHudEnabled }
					/>
					<ExperimentTray expandedTestId={ expandedTestId } />
				</div>,
				portalNode.current
			) }
			<HudOverlays enabled={ hudEnabled } />
		</>
	);
};

// Export for use in global-blocks
export { Portal as PostPageHeader };
