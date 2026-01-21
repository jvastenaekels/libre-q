/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { ArrowRight, Search, Briefcase } from 'lucide-react';
import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';

const LandingPage: React.FC = () => {
    const [slug, setSlug] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { workspaces } = useAuthStore();

    // Smart redirect for authenticated users
    useEffect(() => {
        if (isAuthenticated && workspaces) {
            if (workspaces.length === 0) {
                // No workspaces: redirect to create workspace
                navigate('/admin/workspaces/new', { replace: true });
            } else if (workspaces.length === 1) {
                // Single workspace: redirect directly to workspace dashboard
                navigate(`/app/${workspaces[0].slug}/dashboard`, { replace: true });
            }
            // Multiple workspaces: stay on landing, show hub shortcut
        }
    }, [isAuthenticated, workspaces, navigate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (slug.trim()) {
            navigate(`/study/${slug.trim()}/welcome`);
        }
    };

    const handleGoToHub = () => {
        navigate('/hub');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-6">
                        <img
                            src="/open-q-logo.svg"
                            alt="Open-Q"
                            className="h-20 w-auto object-contain"
                        />
                    </div>
                    <p className="text-gray-500">Enter your study code to begin.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="study-code" className="sr-only">
                            Study Code
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                id="study-code"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="e.g. my-study"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!slug.trim()}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Go to Study <ArrowRight size={16} />
                    </button>
                </form>

                {/* Show Researcher Hub shortcut for multi-workspace users */}
                {isAuthenticated && workspaces && workspaces.length > 1 && (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-white px-2 text-gray-500">Or</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleGoToHub}
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <Briefcase className="h-4 w-4" />
                            Go to Researcher Hub
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export default LandingPage;
