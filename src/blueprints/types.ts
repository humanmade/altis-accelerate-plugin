// Shared types for the Blueprints feature.

export type BlueprintType = 'personalization' | 'abtest';
export type BlueprintStatus = 'draft' | 'published';

/**
 * One variant of a blueprint.
 *
 * - `fallback` variants are the control/default (always index 0) and never
 *   target an audience.
 * - non-fallback variants must reference an existing audience post ID.
 */
export interface BlueprintVariant {
	title: string;
	audience: number;
	fallback: boolean;
	percentage: number | null;
}

export interface Blueprint {
	id?: number;
	title: string;
	type: BlueprintType;
	status: BlueprintStatus;
	goal: string;
	variants: BlueprintVariant[];
	created_at?: string;
	updated_at?: string;
}

export interface BlueprintsState {
	items: Blueprint[];
	loaded: boolean;
	isLoading: boolean;
	isUpdating: boolean;
	isDeleting: boolean;
	// Message from a failed list fetch, or null. Mutation errors are handled
	// where they're dispatched (the rejected promise carries the message).
	error: string | null;
}
