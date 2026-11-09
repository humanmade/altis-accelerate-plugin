import type { ReactNode } from 'react';

interface EmptyStatePreviewProps {
	preview: ReactNode;
	children: ReactNode;
}

/** A static, decorative preview of the list behind its empty-state message. */
export function EmptyStatePreview( { preview, children }: EmptyStatePreviewProps ) {
	return (
		<div className="relative isolate min-h-72 overflow-hidden">
			<div aria-hidden="true" className="pointer-events-none select-none opacity-50 [&_*]:!animate-none">
				{ preview }
			</div>
			<div className="absolute inset-0 flex items-center justify-center p-4">
				<div className="w-full max-w-lg rounded-lg bg-background/95 px-6">
					{ children }
				</div>
			</div>
		</div>
	);
}
