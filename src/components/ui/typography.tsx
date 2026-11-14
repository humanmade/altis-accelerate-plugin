import * as React from 'react';

import { cn } from '@/lib/utils';

type PolymorphicProps<E extends React.ElementType> = {
	as?: E;
	className?: string;
	children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, 'as' | 'className' | 'children'>;

function PageTitle<E extends React.ElementType = 'h1'>( {
	as,
	className,
	...props
}: PolymorphicProps<E> ) {
	const Component = as || 'h1';
	return (
		<Component
			className={ cn( '!text-2xl !font-semibold !tracking-tight text-foreground', className ) }
			{ ...props }
		/>
	);
}

function SectionTitle<E extends React.ElementType = 'h2'>( {
	as,
	className,
	...props
}: PolymorphicProps<E> ) {
	const Component = as || 'h2';
	return (
		<Component
			className={ cn( '!text-lg !font-semibold !tracking-tight text-foreground', className ) }
			{ ...props }
		/>
	);
}

function CardTitle<E extends React.ElementType = 'h3'>( {
	as,
	className,
	...props
}: PolymorphicProps<E> ) {
	const Component = as || 'h3';
	return (
		<Component
			className={ cn( '!text-sm !font-semibold text-foreground', className ) }
			{ ...props }
		/>
	);
}

function Body<E extends React.ElementType = 'p'>( {
	as,
	className,
	...props
}: PolymorphicProps<E> ) {
	const Component = as || 'p';
	return (
		<Component
			className={ cn( '!text-sm text-foreground', className ) }
			{ ...props }
		/>
	);
}

function Caption<E extends React.ElementType = 'p'>( {
	as,
	className,
	...props
}: PolymorphicProps<E> ) {
	const Component = as || 'p';
	return (
		<Component
			className={ cn( '!text-xs text-muted-foreground', className ) }
			{ ...props }
		/>
	);
}

function Overline<E extends React.ElementType = 'span'>( {
	as,
	className,
	...props
}: PolymorphicProps<E> ) {
	const Component = as || 'span';
	return (
		<Component
			className={ cn( '!text-xs !font-medium !uppercase !tracking-wider text-muted-foreground', className ) }
			{ ...props }
		/>
	);
}

export {
	PageTitle, SectionTitle, CardTitle, Body, Caption, Overline,
};
