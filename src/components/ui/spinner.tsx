import { LoaderIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

function Spinner( { className, ...props }: React.ComponentProps<'svg'> ) {
	return (
		<LoaderIcon
			className={ cn( 'size-4 animate-spin', className ) }
			{ ...props }
		/>
	);
}

export { Spinner };
