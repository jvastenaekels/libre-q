/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { renderWithProviders, screen } from '@/test-utils/test-utils';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

const REPO_URL = 'https://github.com/jvastenaekels/qualis';
const LICENSE_URL = 'https://github.com/jvastenaekels/qualis/blob/main/LICENSE';

describe('Footer', () => {
    it('renders the "Powered by Qualis" attribution link to the repo', () => {
        renderWithProviders(<Footer />);
        const link = screen.getByRole('link', { name: /Powered by Qualis/i });
        expect(link).toHaveAttribute('href', REPO_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the AGPLv3 link to the LICENSE file, hidden on small screens', () => {
        renderWithProviders(<Footer />);
        const link = screen.getByRole('link', { name: 'AGPLv3' });
        expect(link).toHaveAttribute('href', LICENSE_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link.className).toContain('hidden');
        expect(link.className).toContain('sm:inline');
    });

    it('renders the GitHub icon link with aria-label', () => {
        renderWithProviders(<Footer />);
        const link = screen.getByRole('link', { name: /View source on GitHub/i });
        expect(link).toHaveAttribute('href', REPO_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the mini Qualis logo as a decorative image', () => {
        renderWithProviders(<Footer />);
        const img = screen.getByAltText('');
        expect(img).toHaveAttribute('src', '/qualis-logo.svg');
    });
});
