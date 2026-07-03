import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import Modal from './modal';

function ModalHarness( props: Omit<React.ComponentProps<typeof Modal>, 'portalId'> ) {
	const [ ready, setReady ] = React.useState( false );

	React.useEffect( () => {
		setReady( true );
	}, [] );

	return (
		<div>
			<div id="storybook-modal-portal" />
			{ ready && <Modal { ...props } portalId="storybook-modal-portal" /> }
		</div>
	);
}

const meta: Meta<typeof Modal> = {
	title: 'Components/Modal',
	component: Modal,
	args: {
		className: '',
		onClose: () => undefined,
	},
};

export default meta;

type Story = StoryObj<typeof Modal>;

export const Default: Story = {
	args: {
		title: 'Edit audience: Returning visitors',
		children: (
			<p>Visitors who have viewed at least 2 pages in the last 30 days.</p>
		),
	},
	render: args => <ModalHarness { ...args } />,
};

export const WithoutTitle: Story = {
	args: {
		children: (
			<p>Create a new audience segment based on visitor behavior.</p>
		),
	},
	render: args => <ModalHarness { ...args } />,
};
