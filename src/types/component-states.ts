export type DataState = 'loading' | 'loaded' | 'empty' | 'error';

export interface DataStateProps {
	state: DataState;
	errorMessage?: string;
	onRetry?: () => void;
}
