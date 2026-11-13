import { Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { chartBar } from '@wordpress/icons';

import SparkChart from '../SparkChart';

import type { Period } from './PeriodChips';

import { Skeleton } from '@/components/ui/skeleton';

interface HistogramPoint {
	index: number;
	count: number;
}

interface ViewsMetricProps {
    views: number;
    histogram?: HistogramPoint[];
    period: Period;
    loading?: boolean;
}

export const ViewsMetric = ( { views, histogram, period, loading = false }: ViewsMetricProps ) => {
	const hasHistogram = !! ( histogram && histogram.length > 0 );
	// Only show "Collecting data..." when not loading AND we have zero views AND no histogram
	const showCollecting = ! loading && views === 0 && ! hasHistogram;

	return (
		<div className="flex text-gray-500 gap-2 font-sans">
			<div className="flex gap-2 items-center">
				<span className="font-bold flex items-center gap-1 text-gray-900 font-sans">
					<Icon icon={ chartBar } size={ 18 } />
					{ __( 'Views', 'altis' ) }
				</span>

				{ loading ? (
					<Skeleton className="h-4 w-16" />
				) : showCollecting ? (
					<span className="font-sans">{ __( 'Collecting data...', 'altis' ) }</span>
				) : (
					<>
						<span className="font-sans">{ views }</span>
						{ hasHistogram && (
							<SparkChart height={ 23 } histogram={ histogram! } period={ period } />
						) }
					</>
				) }
			</div>
		</div>
	);
};
