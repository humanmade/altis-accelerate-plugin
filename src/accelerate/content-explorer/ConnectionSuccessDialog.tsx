import { ArrowRight, Box, FlaskConical, Sparkles, Type } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { trackEvent } from '../../utils/admin';
import StandaloneBlockPreview from '../components/StandaloneBlockPreview';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Body, Caption, CardTitle } from '@/components/ui/typography';

interface WPContentItem {
	id: number;
	date: string;
	title: {
		rendered: string;
		raw?: string;
	};
	content?: {
		raw?: string;
		rendered?: string;
	};
}

interface WPBlockItem {
	id: number;
	title: {
		rendered: string;
		raw?: string;
	};
	rawContent?: string;
	blockType?: string;
}

/**
 * Strip HTML tags from a string to get plain text.
 */
function stripHtml( html: string ): string {
	const tmp = document.createElement( 'div' );
	tmp.innerHTML = html;
	return tmp.textContent || tmp.innerText || '';
}

/**
 * Get the best available title: raw > stripped rendered > fallback.
 */
function getTitle( item: { title: { rendered: string; raw?: string } } ): string {
	if ( item.title.raw ) {
		return item.title.raw;
	}
	const stripped = stripHtml( item.title.rendered );
	return stripped || '';
}

const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 40;

const ROW_CLASSES = '!h-14 w-full !items-center !justify-start !gap-3 !rounded-lg !border !border-border !bg-background !px-3 !text-left shadow-sm hover:!border-brand/40 hover:!bg-muted';

function ContentPreview( { content }: { content?: string } ) {
	if ( content ) {
		return (
			<div className="flex shrink-0 items-center overflow-hidden rounded" style={ {
				width: THUMB_WIDTH,
				height: THUMB_HEIGHT,
			} }>
				<StandaloneBlockPreview
					content={ content }
					height={ THUMB_HEIGHT }
					showShadow={ false }
					width={ THUMB_WIDTH }
				/>
			</div>
		);
	}
	return (
		<div className="flex shrink-0 items-center justify-center rounded bg-muted" style={ {
			width: THUMB_WIDTH,
			height: THUMB_HEIGHT,
		} }>
			<Box className="h-4 w-4 text-muted-foreground" />
		</div>
	);
}

function PostRow( { item, onClick }: { item: WPContentItem; onClick?: () => void } ) {
	const title = getTitle( item );
	const rawContent = item.content?.raw || item.content?.rendered || '';

	return (
		<Button
			asChild
			className={ ROW_CLASSES }
			variant="ghost"
		>
			<a href={ `post.php?post=${ item.id }&action=edit` } onClick={ onClick }>
				<ContentPreview content={ rawContent } />
				<Body as="span" className="!line-clamp-1 flex-1">
					{ title || __( '(no title)', 'altis' ) }
				</Body>
				<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
			</a>
		</Button>
	);
}

function BlockRow( { item, onClick }: { item: WPBlockItem; onClick?: () => void } ) {
	const title = getTitle( item );

	return (
		<Button
			asChild
			className={ ROW_CLASSES }
			variant="ghost"
		>
			<a href={ `post.php?post=${ item.id }&action=edit` } onClick={ onClick }>
				<ContentPreview content={ item.rawContent } />
				<Body as="span" className="!line-clamp-1 flex-1">
					{ title || __( '(no title)', 'altis' ) }
				</Body>
				<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
			</a>
		</Button>
	);
}

export default function ConnectionSuccessDialog() {
	const [ open, setOpen ] = useState( true );
	const [ content, setContent ] = useState< WPContentItem[] >( [] );
	const [ blocks, setBlocks ] = useState< WPBlockItem[] >( [] );

	useEffect( () => {
		trackEvent( 'Onboarding Connection Success Viewed', 'open' );
	}, [] );

	useEffect( () => {
		// Fetch posts and pages with edit context (gives title.raw + content.raw).
		Promise.all( [
			apiFetch< WPContentItem[] >( {
				path: '/wp/v2/posts?per_page=10&status=publish&orderby=date&context=edit',
			} ).catch( () => [] as WPContentItem[] ),
			apiFetch< WPContentItem[] >( {
				path: '/wp/v2/pages?per_page=10&status=publish&orderby=date&context=edit',
			} ).catch( () => [] as WPContentItem[] ),
		] ).then( ( [ posts, pages ] ) => {
			const merged = [ ...posts, ...pages ]
				.sort( ( a, b ) => new Date( b.date ).getTime() - new Date( a.date ).getTime() )
				.slice( 0, 3 );
			setContent( merged );
		} );

		// Fetch blocks with edit context to get title.raw, filter to standard only.
		apiFetch< WPBlockItem[] >( {
			path: '/wp/v2/blocks?per_page=10&status=publish&context=edit',
		} ).then( items => {
			const standard = items
				.filter( item => ! item.blockType || item.blockType === 'standard' )
				.slice( 0, 3 );
			setBlocks( standard );
		} ).catch( () => {} );
	}, [] );

	const handleClose = () => {
		trackEvent( 'Onboarding Connection Success Clicked', 'dismiss' );
		setOpen( false );
		window.history.replaceState( null, '', window.location.pathname + '?page=accelerate' );
	};

	return (
		<div className="tailwind">
			<Dialog open={ open } onOpenChange={ value => ! value && handleClose() }>
				<DialogContent className="sm:max-w-[540px]">
					<DialogHeader>
						<DialogTitle className="!text-xl">
							{ __( 'Your site is connected!', 'altis' ) }
						</DialogTitle>
						<DialogDescription>
							{ __( 'Start optimizing your content with A/B tests. Pick something to test:', 'altis' ) }
						</DialogDescription>
					</DialogHeader>

					{ /* Test a headline section */ }
					<div className="space-y-2">
						<div>
							<div className="flex items-center gap-2">
								<Type className="h-4 w-4 text-brand" />
								<CardTitle>{ __( 'Test a headline', 'altis' ) }</CardTitle>
								<Caption as="span" className="inline-flex items-center gap-1">
									<Sparkles className="h-3 w-3" />
									{ __( 'Recommended', 'altis' ) }
								</Caption>
							</div>
							<Caption className="!mt-0.5">
								{ __( 'Add alternative titles and see which gets more clicks.', 'altis' ) }
							</Caption>
						</div>
						<div className="space-y-1.5">
							{ content.length > 0 ? (
								content.map( item => (
									<PostRow
										key={ item.id }
										item={ item }
										onClick={ () => trackEvent( 'Onboarding Connection Success Clicked', 'headline', { content_id: item.id } ) }
									/>
								) )
							) : (
								<Caption className="!italic">{ __( 'No published posts or pages yet.', 'altis' ) }</Caption>
							) }
						</div>
					</div>

					{ /* Test a block section */ }
					<div className="space-y-2">
						<div>
							<div className="flex items-center gap-2">
								<FlaskConical className="h-4 w-4 text-muted-foreground" />
								<CardTitle>{ __( 'Test a block', 'altis' ) }</CardTitle>
							</div>
							<Caption className="!mt-0.5">
								{ __( 'Compare different versions of a synced pattern across your site.', 'altis' ) }
							</Caption>
						</div>
						<div className="space-y-1.5">
							{ blocks.length > 0 ? (
								blocks.map( block => (
									<BlockRow
										key={ block.id }
										item={ block }
										onClick={ () => trackEvent( 'Onboarding Connection Success Clicked', 'block', { content_id: block.id } ) }
									/>
								) )
							) : (
								<Button
									asChild
									className={ ROW_CLASSES }
									variant="ghost"
								>
									<a
										href="post-new.php?post_type=wp_block"
										onClick={ () => trackEvent( 'Onboarding Connection Success Clicked', 'create_pattern' ) }
									>
										<Body as="span" className="flex-1">{ __( 'Create your first pattern', 'altis' ) }</Body>
										<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
									</a>
								</Button>
							) }
						</div>
					</div>

					<Caption className="!text-center">
						{ __( 'You can always start a test later from any post editor.', 'altis' ) }
					</Caption>
				</DialogContent>
			</Dialog>
		</div>
	);
}
