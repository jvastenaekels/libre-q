/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { FaGithub } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';

const REPO_URL = 'https://github.com/jvastenaekels/qualis';
const LICENSE_URL = 'https://github.com/jvastenaekels/qualis/blob/main/LICENSE';

export const Footer = () => {
    const { t } = useTranslation();

    return (
        <footer className="border-t border-slate-100 bg-white/70 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-slate-600 transition-colors"
                    >
                        <img src="/qualis-logo.svg" alt="" className="h-4 w-4" />
                        <span>{t('footer.powered_by', 'Powered by Qualis')}</span>
                    </a>
                    <span className="hidden sm:inline" aria-hidden="true">
                        ·
                    </span>
                    <a
                        href={LICENSE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline hover:text-slate-600 transition-colors"
                    >
                        {t('footer.license', 'AGPLv3')}
                    </a>
                </div>
                <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('footer.github_aria', 'View source on GitHub')}
                    className="hover:text-slate-600 transition-colors"
                >
                    <FaGithub className="h-4 w-4" />
                </a>
            </div>
        </footer>
    );
};
