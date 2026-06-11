import { Check, FlaskConical, Type, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

import { trackEvent } from '../../utils/admin';

import { Button } from '@/components/ui/button';
import { Body, Caption } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

interface OnboardingData {
	connected_at: number | false;
	first_test_created: number | false;
	authorize_url: string;
}

interface Props {
	onboarding: OnboardingData;
	userName: string;
	onDismiss: () => void;
}

interface WPContentItem {
	id: number;
	title: { rendered: string; raw?: string };
}

// Dark-bar palette — explicit so dark-mode overrides on the
// surrounding admin theme don't drift it.
const COLORS = {
	bg: '#111',
};

function StepDot( {
	complete,
	active,
	label,
}: {
	complete: boolean;
	active: boolean;
	label: string;
} ) {
	return (
		<div className="flex items-center gap-1.5">
			<div
				className={ cn(
					'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
					complete && 'border-brand bg-brand text-white',
					active && ! complete && 'border-brand bg-transparent text-brand',
					! active && ! complete && 'border-white/20 bg-transparent'
				) }
			>
				{ complete ? (
					<Check className="h-2.5 w-2.5" strokeWidth={ 3 } />
				) : null }
			</div>
			<Body
				as="span"
				className={ cn(
					'!text-xs !font-medium',
					complete && '!text-white/40 line-through',
					active && ! complete && '!text-white',
					! active && ! complete && '!text-white/40'
				) }
			>
				{ label }
			</Body>
		</div>
	);
}

export default function OnboardingBar( { onboarding, userName, onDismiss }: Props ) {
	const [ recentPostUrl, setRecentPostUrl ] = useState<string | null>( null );

	const step1Done = !! onboarding.connected_at;
	const step2Done = !! onboarding.first_test_created;
	const step3Done = false;

	let currentStep = 1;
	if ( step1Done ) {
		currentStep = 2;
	}
	if ( step2Done ) {
		currentStep = 3;
	}

	const completedCount = [ step1Done, step2Done, step3Done ].filter( Boolean ).length;

	useEffect( () => {
		if ( ! step1Done || step2Done ) {
			return;
		}
		apiFetch<WPContentItem[]>( {
			path: '/wp/v2/posts?per_page=1&status=publish&orderby=date',
		} )
			.then( posts => {
				if ( posts.length > 0 ) {
					setRecentPostUrl( `post.php?post=${ posts[ 0 ].id }&action=edit` );
				}
			} )
			.catch( () => {} );
	}, [ step1Done, step2Done ] );

	useEffect( () => {
		trackEvent( 'onboarding_checklist_viewed', { step: currentStep } );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const handleDismiss = () => {
		trackEvent( 'onboarding_checklist_dismissed', { step: currentStep } );
		onDismiss();
	};

	const renderAction = () => {
		if ( ! step1Done ) {
			return (
				<Button
					asChild
					className="!bg-brand !text-white hover:!bg-brand-hover"
					size="sm"
				>
					<a
						href={ onboarding.authorize_url }
						onClick={ () => trackEvent( 'onboarding_checklist_connect_clicked' ) }
					>
						{ __( 'Connect', 'altis' ) }
					</a>
				</Button>
			);
		}
		if ( ! step2Done ) {
			return (
				<div className="flex items-center gap-2">
					<Button
						asChild
						className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
						size="sm"
						variant="outline"
					>
						<a
							href={ recentPostUrl || 'edit.php' }
							onClick={ () => trackEvent( 'onboarding_checklist_test_headline_clicked', { step: currentStep } ) }
						>
							<Type className="mr-1.5 h-3.5 w-3.5" />
							{ __( 'Test a headline', 'altis' ) }
						</a>
					</Button>
					<Button
						asChild
						className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
						size="sm"
						variant="outline"
					>
						<a
							href="edit.php?post_type=wp_block"
							onClick={ () => trackEvent( 'onboarding_checklist_test_block_clicked', { step: currentStep } ) }
						>
							<FlaskConical className="mr-1.5 h-3.5 w-3.5" />
							{ __( 'Test a block', 'altis' ) }
						</a>
					</Button>
				</div>
			);
		}
		return (
			<Caption className="!text-white/60">{ __( 'Publish a test and check back in 24 hours.', 'altis' ) }</Caption>
		);
	};

	const headline = step1Done
		? __( 'Getting started', 'altis' )
		: sprintf( /* translators: %s: user display name */ __( 'Welcome, %s', 'altis' ), userName );

	return (
		<div className="tailwind">
			<div style={ { backgroundColor: COLORS.bg } }>
				<div className="mx-4 flex flex-col gap-3 py-3 lg:mx-16 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
						<h3 className="!m-0 !text-sm !font-semibold !text-white">{ headline }</h3>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
							<StepDot
								active={ currentStep === 1 }
								complete={ step1Done }
								label={ __( 'Connect', 'altis' ) }
							/>
							<StepDot
								active={ currentStep === 2 }
								complete={ step2Done }
								label={ __( 'Run an experiment', 'altis' ) }
							/>
							<StepDot
								active={ currentStep === 3 }
								complete={ step3Done }
								label={ __( 'See results', 'altis' ) }
							/>
						</div>
						<Caption className="!ml-auto !text-white/50 tabular-nums md:!ml-0">
							{ sprintf(
								/* translators: 1: completed step count, 2: total steps */
								__( '%1$d of %2$d', 'altis' ),
								completedCount,
								3
							) }
						</Caption>
					</div>
					<div className="flex items-center justify-end gap-2">
						{ renderAction() }
						<Button
							aria-label={ __( 'Dismiss onboarding', 'altis' ) }
							className="!h-8 !w-8 !p-0 !text-white/60 hover:!bg-white/10 hover:!text-white"
							size="sm"
							variant="ghost"
							onClick={ handleDismiss }
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
