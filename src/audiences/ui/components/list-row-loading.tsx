import React from 'react';
import ContentLoader from 'react-content-loader';

/**
 * Audience list loading component.
 */
const ListRowLoading = () => (
	<div className="flex items-center py-4 border-b border-border">
		<div className="w-12 shrink-0">
		</div>
		<div className="flex-1 min-w-0">
			<ContentLoader height={ 30 } viewBox="0 0 200 30" width={ 200 }>
				<rect height="12" rx="3" ry="3" width="200" x="0" y="0" />
				<rect height="8" rx="3" ry="3" width="50" x="0" y="18" />
			</ContentLoader>
		</div>
		<div className="w-48 shrink-0">
			<ContentLoader height={ 10 } viewBox="0 0 100 10" width={ 100 }>
				<rect height="8" rx="3" ry="3" width="18" x="0" y="1" />
				<rect height="8" rx="3" ry="3" width="60" x="24" y="1" />
			</ContentLoader>
		</div>
		<div className="w-32 shrink-0">
			<ContentLoader height={ 20 } viewBox="0 0 80 20" width={ 80 }>
				<rect height="8" rx="3" ry="3" width="60" x="0" y="6" />
			</ContentLoader>
		</div>
	</div>
);

export default ListRowLoading;
