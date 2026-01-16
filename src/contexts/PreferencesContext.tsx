/**
 * Component: User Preferences Context Provider
 * Documentation: Manages user preferences (card size, etc.) with localStorage persistence
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Preferences {
  cardSize: number; // 1-9, default 5
}

interface PreferencesContextType {
  cardSize: number;
  setCardSize: (size: number) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: Preferences = {
  cardSize: 5,
};

const STORAGE_KEY = 'preferences';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [cardSize, setCardSizeState] = useState<number>(DEFAULT_PREFERENCES.cardSize);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const preferences: Preferences = JSON.parse(stored);
        // Validate cardSize is within range 1-9
        if (preferences.cardSize >= 1 && preferences.cardSize <= 9) {
          setCardSizeState(preferences.cardSize);
        } else {
          // Invalid size, reset to default
          setCardSizeState(DEFAULT_PREFERENCES.cardSize);
        }
      }
    } catch (error) {
      console.error('Failed to load preferences from localStorage:', error);
      setCardSizeState(DEFAULT_PREFERENCES.cardSize);
    }
  }, []);

  // Update card size in state and localStorage
  const setCardSize = (size: number) => {
    if (typeof window === 'undefined') return;

    // Validate size is within range 1-9
    const validSize = Math.max(1, Math.min(9, size));

    setCardSizeState(validSize);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferences: Preferences = stored ? JSON.parse(stored) : { ...DEFAULT_PREFERENCES };
      preferences.cardSize = validSize;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  };

  // Listen for storage changes in other tabs (cross-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const preferences: Preferences = JSON.parse(e.newValue);
          // Validate cardSize is within range 1-9
          if (preferences.cardSize >= 1 && preferences.cardSize <= 9) {
            setCardSizeState(preferences.cardSize);
          }
        } catch (error) {
          console.error('Failed to parse preferences from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <PreferencesContext.Provider value={{ cardSize, setCardSize }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
