import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState — Wave E (E2) primitive', () => {
    it('renders title + body + icon in card variant by default', () => {
        render(
            <MemoryRouter>
                <EmptyState
                    icon={Inbox}
                    title="No data yet"
                    body="Share the link to start collecting."
                />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { name: 'No data yet' })).toBeInTheDocument();
        expect(screen.getByText('Share the link to start collecting.')).toBeInTheDocument();
    });

    it('renders a Link CTA when cta.to is supplied', () => {
        render(
            <MemoryRouter>
                <EmptyState title="Empty" cta={{ label: 'Go home', to: '/home' }} />
            </MemoryRouter>
        );
        const cta = screen.getByRole('link', { name: 'Go home' });
        expect(cta).toBeInTheDocument();
        expect(cta).toHaveAttribute('href', '/home');
    });

    it('renders a button CTA when cta.onClick is supplied (no `to`)', async () => {
        const onClick = vi.fn();
        render(
            <MemoryRouter>
                <EmptyState title="Empty" cta={{ label: 'Do thing', onClick }} />
            </MemoryRouter>
        );
        const cta = screen.getByRole('button', { name: 'Do thing' });
        cta.click();
        expect(onClick).toHaveBeenCalled();
    });

    it('compact variant renders inline italic text without icon', () => {
        render(
            <EmptyState
                icon={Inbox}
                title="No matches"
                body="Adjust your filters."
                variant="compact"
            />
        );
        // Compact intentionally drops the icon wrapper
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(screen.getByText(/No matches/i)).toBeInTheDocument();
    });
});
