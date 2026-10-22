import { X } from 'lucide-react';

import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { trackEvent } from '../../utils/admin';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Body, SectionTitle } from '@/components/ui/typography';

interface OnboardingData {
	connected_at: number | false;
	first_test_created: number | false;
	authorize_url: string;
	setup_url: string;
}

interface Props {
	onboarding: OnboardingData;
	onDismiss: () => void;
}

export default function OnboardingBar( { onboarding, onDismiss }: Props ) {
	const [ leaving, setLeaving ] = useState( false );

	useEffect( () => {
		trackEvent( 'onboarding_checklist_viewed', { step: 1 } );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		const restore = () => setLeaving( false );
		window.addEventListener( 'pageshow', restore );
		return () => window.removeEventListener( 'pageshow', restore );
	}, [] );

	return (
		<div className="tailwind">
			<section className="mx-4 my-5 flex flex-wrap items-center justify-between gap-5 rounded-lg border border-border bg-background p-5 lg:mx-16">
				<div className="min-w-0 flex-1 space-y-2">
					<SectionTitle>{ __( 'Connect your site to Accelerate', 'altis' ) }</SectionTitle>
					<Body>{ __( 'Create an account or sign in, and choose your options in one place.', 'altis' ) }</Body>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						aria-busy={ leaving }
						disabled={ leaving }
						onClick={ () => {
							setLeaving( true );
							trackEvent( 'onboarding_checklist_connect_clicked' );
							window.location.assign( onboarding.setup_url );
						} }
					>
						{ leaving && <Spinner /> }
						{ __( 'Set up Accelerate', 'altis' ) }
					</Button>
					<Button aria-label={ __( 'Dismiss getting started', 'altis' ) } size="icon" variant="ghost" onClick={ () => {
						trackEvent( 'onboarding_checklist_dismissed', { step: 1 } ); onDismiss();
					} }><X aria-hidden="true" className="size-4" /></Button>
				</div>
			</section>
		</div>
	);
}
