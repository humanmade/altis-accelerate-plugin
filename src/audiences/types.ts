export type StringOperator = '=' | '!=' | '*=' | '!*' | '^=';
export type NumericOperator = '=' | '!=' | 'gt' | 'gte' | 'lt' | 'lte';
export type Operator = StringOperator | NumericOperator;

export type Rule = {
	field: string,
	value: string,
} & (
	{ type: 'string', operator: StringOperator } |
	{ type: 'number', operator: NumericOperator }
);

export interface Group {
	include: 'any' | 'all',
	rules?: Rule[],
	groups?: Group[],
}

export type Audience = Group;

export type Post = {
	id: number,
	error?: any, // huh?
	title: {
		raw?: string,
		rendered: string,
	},
	status: 'publish' | 'draft' | 'auto-draft' | 'trash';
	menu_order: number,
	slug: string,
	type: string,
	audience?: Audience,
	estimate?: Estimate,
}

export type Field = {
	name: string,
	label: string,
	options: any,
} & (
	{
		type: 'string',
		data: {
			label?: string,
			value: string,
			percent: number,
			count: number,
		}[],
		stats: undefined,
	} | {
		type: 'number',
		data: undefined,
		stats: {
			avg: number,
			min: number,
			max: number,
		},
	}
);

export interface Estimate {
	count: number,
	isLoading: boolean,
	total: number,
	histogram: Array<{ count: number }>,
};

export type Pagination = {
	total?: number,
	pages?: number,
}

export interface State {
	estimates: {
		[ k: string ]: Estimate
	},
	fields: Field[],
	pagination: Pagination,
	post: Post, // maybe
	posts: Post[],
	isLoading: boolean,
	isUpdating: boolean,
	isDeleting: boolean,
};
