import React, { useState, useMemo, type ReactNode } from 'react';
import { LayoutStateContext, LayoutActionContext } from './LayoutContext.context';

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [headerAction, setHeaderAction] = useState<ReactNode>(null);

    const actions = useMemo(() => ({ setHeaderAction }), []);

    return (
        <LayoutActionContext.Provider value={actions}>
            <LayoutStateContext.Provider value={{ headerAction }}>
                {children}
            </LayoutStateContext.Provider>
        </LayoutActionContext.Provider>
    );
};
