import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from './button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from './dialog';

const meta: Meta<typeof Dialog> = {
	title: 'Components/UI/Dialog',
	component: Dialog,
};

export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
	render: () => (
		<Dialog>
			<DialogTrigger asChild>
				<Button>Create experiment</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create a new experiment</DialogTitle>
					<DialogDescription>
						Choose a block to test and set up your variants.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button>Continue</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

export const DestructiveConfirm: Story = {
	render: () => (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="destructive">Delete variant</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this variant?</DialogTitle>
					<DialogDescription>
						This removes the variant and its collected analytics data. This action can&apos;t be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button variant="destructive">Delete</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

export const HiddenCloseButton: Story = {
	render: () => (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline">View audience match</Button>
			</DialogTrigger>
			<DialogContent hideCloseButton>
				<DialogHeader>
					<DialogTitle>Audience match</DialogTitle>
					<DialogDescription>
						Returning visitors from the EU who viewed pricing in the last 7 days.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button>Got it</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};
