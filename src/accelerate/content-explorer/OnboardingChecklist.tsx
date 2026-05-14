import { Check, FlaskConical, Type } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { trackEvent } from '../../utils/admin';

import { Button } from '@/components/ui/button';
import {
	Body,
	Caption,
	CardTitle,
} from '@/components/ui/typography';

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
	title: {
		rendered: string;
		raw?: string;
	};
}

function StepNumber( { number, complete, active }: { number: number; complete: boolean; active: boolean } ) {
	if ( complete ) {
		return (
			<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand">
				<Check className="h-3 w-3 text-white" strokeWidth={ 2.5 } />
			</div>
		);
	}
	if ( active ) {
		return (
			<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-brand">
				<Body as="span" className="!text-[10px] !font-semibold !leading-none text-brand">{ number }</Body>
			</div>
		);
	}
	return (
		<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border">
			<Body as="span" className="!text-[10px] !leading-none text-muted-foreground">{ number }</Body>
		</div>
	);
}

export default function OnboardingChecklist( { onboarding, userName, onDismiss }: Props ) {
	const [ recentPostUrl, setRecentPostUrl ] = useState< string | null >( null );

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
	const progressPercent = Math.round( ( completedCount / 3 ) * 100 );

	// Fetch most recent post for "Test a headline" link.
	useEffect( () => {
		if ( ! step1Done || step2Done ) {
			return;
		}
		apiFetch< WPContentItem[] >( {
			path: '/wp/v2/posts?per_page=1&status=publish&orderby=date',
		} ).then( posts => {
			if ( posts.length > 0 ) {
				setRecentPostUrl( `post.php?post=${ posts[ 0 ].id }&action=edit` );
			}
		} ).catch( () => {} );
	}, [ step1Done, step2Done ] );

	// Track checklist impression.
	useEffect( () => {
		trackEvent( 'onboarding_checklist_viewed', { step: currentStep } );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const handleDismiss = () => {
		trackEvent( 'onboarding_checklist_dismissed', { step: currentStep } );
		onDismiss();
	};

	return (
		<div className="tailwind">
			<div className="flex flex-col rounded-lg border border-border bg-white shadow-sm">
				{ /* Header with progress */ }
				<div className="border-b border-border px-3 pb-2.5 pt-3">
					<div className="flex items-center justify-between">
						<CardTitle>{ __( 'Getting Started', 'altis' ) }</CardTitle>
						<Caption className="!tabular-nums">{ progressPercent }%</Caption>
					</div>
					<div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-brand"
							style={ {
								width: `${ progressPercent }%`,
								transition: 'width 0.3s ease',
							} }
						/>
					</div>
				</div>

				{ /* Steps */ }
				<div className="flex flex-col px-3 py-2">
					{ /* Step 1: Connect */ }
					<div className={ `flex gap-2.5 rounded-md p-1.5 ${ currentStep === 1 ? 'bg-muted/50' : '' }` }>
						<div className="mt-0.5">
							<StepNumber active={ currentStep === 1 } complete={ step1Done } number={ 1 } />
						</div>
						<div className="flex-1">
							<CardTitle className={ `!m-0 ${ step1Done ? '!text-muted-foreground' : '' }` }>
								{ __( 'Connect your site', 'altis' ) }
							</CardTitle>
							{ step1Done && (
								<Caption>
									{ __( 'Connected as', 'altis' ) } { userName }
								</Caption>
							) }
							{ ! step1Done && currentStep === 1 && (
								<>
									<Caption>
										{ __( 'Link your Accelerate account to start tracking.', 'altis' ) }
									</Caption>
									<div className="mt-1.5">
										<Button asChild size="sm" variant="outline">
											<a
												href={ onboarding.authorize_url }
												onClick={ () => trackEvent( 'onboarding_checklist_connect_clicked' ) }
											>
												{ __( 'Connect', 'altis' ) }
											</a>
										</Button>
									</div>
								</>
							) }
						</div>
					</div>

					{ /* Step 2: Run first experiment */ }
					<div className={ `flex gap-2.5 rounded-md p-1.5 ${ currentStep === 2 ? 'bg-muted/50' : '' }` }>
						<div className="mt-0.5">
							<StepNumber active={ currentStep === 2 } complete={ step2Done } number={ 2 } />
						</div>
						<div className="flex-1">
							<CardTitle className={ `!m-0 ${ step2Done ? '!text-muted-foreground' : '' }` }>
								{ __( 'Run your first experiment', 'altis' ) }
							</CardTitle>
							{ step2Done && (
								<Caption>{ __( 'Experiment created', 'altis' ) }</Caption>
							) }
							{ ! step2Done && currentStep === 2 && (
								<div className="mt-1 space-y-1">
									<Button
										asChild
										className="!w-full !justify-start !gap-2"
										size="sm"
										variant="outline"
									>
										<a
											href={ recentPostUrl || 'edit.php' }
											onClick={ () => trackEvent( 'onboarding_checklist_test_headline_clicked', { step: currentStep } ) }
										>
											<Type className="h-3.5 w-3.5" />
											{ __( 'Test a headline', 'altis' ) }
										</a>
									</Button>
									<Button
										asChild
										className="!w-full !justify-start !gap-2"
										size="sm"
										variant="outline"
									>
										<a
											href="edit.php?post_type=wp_block"
											onClick={ () => trackEvent( 'onboarding_checklist_test_block_clicked', { step: currentStep } ) }
										>
											<FlaskConical className="h-3.5 w-3.5" />
											{ __( 'Test a block', 'altis' ) }
										</a>
									</Button>
								</div>
							) }
						</div>
					</div>

					{ /* Step 3: See results */ }
					<div className={ `flex gap-2.5 rounded-md p-1.5 ${ currentStep === 3 ? 'bg-muted/50' : '' }` }>
						<div className="mt-0.5">
							<StepNumber active={ currentStep === 3 } complete={ step3Done } number={ 3 } />
						</div>
						<div className="flex-1">
							<CardTitle className={ `!m-0 ${ step3Done ? '!text-muted-foreground' : '' }` }>
								{ __( 'See your results', 'altis' ) }
							</CardTitle>
							{ currentStep === 3 && (
								<Caption>
									{ __( 'Publish your test and check back in 24 hours.', 'altis' ) }
								</Caption>
							) }
						</div>
					</div>
				</div>

				{ /* Footer */ }
				<div className="border-t border-border px-3 py-2">
					<div className="flex items-center justify-between">
						<Caption>
							{ `${ completedCount } ${ __( 'of', 'altis' ) } 3 ${ __( 'complete', 'altis' ) }` }
						</Caption>
						<Button
							className="!h-auto !px-0 !text-xs"
							variant="link"
							onClick={ handleDismiss }
						>
							{ __( 'Dismiss', 'altis' ) }
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
