import { useCallback, useEffect, useState } from 'react';

export type ChartPresentation = 'line' | 'bar';

const DEFAULT_PRESENTATION: ChartPresentation = 'bar';
const STORAGE_PREFIX = 'altis-state-';
const SYNC_EVENT = 'altis-chart-presentation-change';
const COMPARISON_SYNC_EVENT = 'altis-chart-comparison-change';

export function isChartPresentation( value: unknown ): value is ChartPresentation {
	return value === 'line' || value === 'bar';
}

function readPresentation( storageKey: string ): ChartPresentation {
	try {
		const stored = window.localStorage.getItem( storageKey );
		if ( stored === null ) {
			return DEFAULT_PRESENTATION;
		}
		const parsed: unknown = JSON.parse( stored );
		return isChartPresentation( parsed ) ? parsed : DEFAULT_PRESENTATION;
	} catch {
		return DEFAULT_PRESENTATION;
	}
}

function readComparison( storageKey: string ): boolean {
	try {
		return JSON.parse( window.localStorage.getItem( storageKey ) || 'false' ) === true;
	} catch {
		return false;
	}
}

type PresentationChangeDetail = {
	storageKey: string;
	value: ChartPresentation;
};

type ComparisonChangeDetail = {
	storageKey: string;
	value: boolean;
};

/**
 * Persist a tile-scoped chart style while validating both reads and writes.
 */
export function useChartPresentation( tileKey: string ): [ ChartPresentation, ( value: ChartPresentation ) => void ] {
	const storageKey = `${ STORAGE_PREFIX }${ tileKey }-chart-style`;
	const [ presentation, setPresentation ] = useState<ChartPresentation>( () => readPresentation( storageKey ) );

	useEffect( () => {
		setPresentation( readPresentation( storageKey ) );

		const syncFromStorage = ( event: StorageEvent ) => {
			if ( event.key === storageKey ) {
				setPresentation( readPresentation( storageKey ) );
			}
		};
		const syncInDocument = ( event: Event ) => {
			const detail = ( event as CustomEvent<PresentationChangeDetail> ).detail;
			if ( detail.storageKey === storageKey ) {
				setPresentation( detail.value );
			}
		};

		window.addEventListener( 'storage', syncFromStorage );
		window.addEventListener( SYNC_EVENT, syncInDocument );
		return () => {
			window.removeEventListener( 'storage', syncFromStorage );
			window.removeEventListener( SYNC_EVENT, syncInDocument );
		};
	}, [ storageKey ] );

	const setPersistentPresentation = useCallback( ( value: ChartPresentation ) => {
		if ( ! isChartPresentation( value ) ) {
			return;
		}
		try {
			window.localStorage.setItem( storageKey, JSON.stringify( value ) );
		} catch {
			// Persistence is optional; the in-memory selection still works.
		}
		setPresentation( value );
		window.dispatchEvent( new CustomEvent<PresentationChangeDetail>( SYNC_EVENT, {
			detail: {
				storageKey,
				value,
			},
		} ) );
	}, [ storageKey ] );

	return [ presentation, setPersistentPresentation ];
}

/**
 * Persist a tile-scoped prior-period comparison preference.
 */
export function useChartComparison( tileKey: string ): [ boolean, ( value: boolean ) => void ] {
	const storageKey = `${ STORAGE_PREFIX }${ tileKey }-compare-to-prior`;
	const [ comparison, setComparison ] = useState<boolean>( () => readComparison( storageKey ) );

	useEffect( () => {
		setComparison( readComparison( storageKey ) );

		const syncFromStorage = ( event: StorageEvent ) => {
			if ( event.key === storageKey ) {
				setComparison( readComparison( storageKey ) );
			}
		};
		const syncInDocument = ( event: Event ) => {
			const detail = ( event as CustomEvent<ComparisonChangeDetail> ).detail;
			if ( detail.storageKey === storageKey ) {
				setComparison( detail.value );
			}
		};

		window.addEventListener( 'storage', syncFromStorage );
		window.addEventListener( COMPARISON_SYNC_EVENT, syncInDocument );
		return () => {
			window.removeEventListener( 'storage', syncFromStorage );
			window.removeEventListener( COMPARISON_SYNC_EVENT, syncInDocument );
		};
	}, [ storageKey ] );

	const setPersistentComparison = useCallback( ( value: boolean ) => {
		if ( typeof value !== 'boolean' ) {
			return;
		}
		try {
			window.localStorage.setItem( storageKey, JSON.stringify( value ) );
		} catch {
			// Persistence is optional; the in-memory selection still works.
		}
		setComparison( value );
		window.dispatchEvent( new CustomEvent<ComparisonChangeDetail>( COMPARISON_SYNC_EVENT, {
			detail: {
				storageKey,
				value,
			},
		} ) );
	}, [ storageKey ] );

	return [ comparison, setPersistentComparison ];
}
