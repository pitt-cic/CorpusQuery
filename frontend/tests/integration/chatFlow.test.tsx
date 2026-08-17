import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import ChatPanel from '@/pages/ChatPanel';

describe('Chat Flow Integration', () => {
  it('displays sessions and messages when session is selected', async () => {
    renderWithProviders(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Climate modeling/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/Climate modeling/));

    await waitFor(() => {
      expect(
        screen.getByText(/What are the key limitations of current climate models/)
      ).toBeInTheDocument();
    });
  });

  it('shows answer text after selecting a session with completed jobs', async () => {
    renderWithProviders(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Climate modeling/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/Climate modeling/));

    await waitFor(() => {
      expect(screen.getByText(/climate models face/i)).toBeInTheDocument();
    });
  });

  it('submits a new question and shows status indicator', async () => {
    renderWithProviders(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Climate modeling/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/Climate modeling/));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask about your papers/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask about your papers/);
    await userEvent.type(input, 'How do feedback loops affect prediction accuracy?');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    });
  });
});
