import React, { useCallback } from 'react';

import { Button } from '@/components/ui/button';

const { useSelect } = wp.data;
const { __ } = wp.i18n;

/**
 * Image input component using wp.media frame with shadcn buttons.
 *
 * @param {React.ComponentProps} props The component props.
 * @returns {React.ReactNode} Image input field component.
 */
const ImageInput = props => {
	const {
		compact,
		value,
		onChange,
		isEditable,
	} = props;

	const media = useSelect(
		select =>
			value && select( 'core' ).getMedia( value ),
		[ value ]
	);

	const openMediaLibrary = useCallback( () => {
		const frame = wp.media( {
			title: __( 'Select Image', 'altis' ),
			button: { text: __( 'Use this image', 'altis' ) },
			multiple: false,
			library: { type: 'image' },
		} );

		frame.on( 'select', () => {
			const attachment = frame.state().get( 'selection' ).first().toJSON();
			onChange( attachment.id );
		} );

		frame.open();
	}, [ onChange ] );

	if ( compact ) {
		return (
			<div className="relative group inline-flex items-center gap-2">
				{ media ? (
					<>
						<img
							alt={ media.alt_text || __( 'Featured image', 'altis' ) }
							className="!max-w-[280px] !max-h-[140px] !w-auto !h-auto rounded object-contain"
							src={ media.source_url }
						/>
						{ isEditable && (
							<Button
								className="!h-6 !px-2 !text-xs opacity-0 group-hover:opacity-100 transition-opacity"
								size="sm"
								variant="outline"
								onClick={ openMediaLibrary }
							>
								{ __( 'Replace', 'altis' ) }
							</Button>
						) }
					</>
				) : (
					isEditable && (
						<Button
							size="sm"
							variant="outline"
							onClick={ openMediaLibrary }
						>
							{ __( 'Select', 'altis' ) }
						</Button>
					)
				) }
			</div>
		);
	}

	return (
		<div>
			{ isEditable && (
				<Button
					className="!w-full"
					variant="outline"
					onClick={ openMediaLibrary }
				>
					{ value ? __( 'Replace image', 'altis' ) : __( 'Select image', 'altis' ) }
				</Button>
			) }
			{ media && (
				<img
					alt={ media.alt_text || __( 'Featured image', 'altis' ) }
					className="max-w-[600px] max-h-[300px] w-auto h-auto rounded mt-2 object-contain"
					src={ media.source_url }
				/>
			) }
		</div>
	);
};

export default ImageInput;
