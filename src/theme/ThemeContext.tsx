import { createContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

export interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    accentColor: AccentColor;
    setAccentColor: (color: AccentColor) => void;
    isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

const accentColors: Record<AccentColor, { primary: string; ring: string }> = {
    blue: { primary: '217 78% 55%', ring: '217 78% 55%' },
    purple: { primary: '262 72% 54%', ring: '262 72% 54%' },
    green: { primary: '142 65% 42%', ring: '142 65% 42%' },
    orange: { primary: '28 88% 62%', ring: '28 88% 62%' },
    pink: { primary: '330 75% 56%', ring: '330 75% 56%' },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('bingowork-theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
        return 'system';
    });

    const [accentColor, setAccentColor] = useState<AccentColor>(() => {
        const saved = localStorage.getItem('bingowork-accent');
        if (['blue', 'purple', 'green', 'orange', 'pink'].includes(saved || '')) {
            return saved as AccentColor;
        }
        return 'blue';
    });

    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        localStorage.setItem('bingowork-theme', mode);

        const updateDark = () => {
            let dark = false;
            if (mode === 'dark') dark = true;
            else if (mode === 'system') {
                dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
            setIsDark(dark);
            document.documentElement.classList.toggle('dark', dark);
        };

        updateDark();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', updateDark);
        return () => mediaQuery.removeEventListener('change', updateDark);
    }, [mode]);

    useEffect(() => {
        localStorage.setItem('bingowork-accent', accentColor);
        const colors = accentColors[accentColor];
        document.documentElement.style.setProperty('--primary', colors.primary);
        document.documentElement.style.setProperty('--ring', colors.ring);
    }, [accentColor]);

    return (
        <ThemeContext.Provider value={{ mode, setMode, accentColor, setAccentColor, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

// Re-export useTheme for convenience
export { useTheme } from './useTheme';
