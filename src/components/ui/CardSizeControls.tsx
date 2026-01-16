/**
 * Component: Card Size Controls
 * Documentation: UI controls for adjusting audiobook card size (zoom level)
 */

'use client';

import React from 'react';

interface CardSizeControlsProps {
  size: number; // 1-9
  onSizeChange: (size: number) => void;
}

// Column count mapping for each size at each breakpoint
const columnMap = {
  base: { 1: 4, 2: 3, 3: 3, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 1 },
  md: { 1: 6, 2: 5, 3: 4, 4: 4, 5: 3, 6: 3, 7: 3, 8: 2, 9: 1 },
  lg: { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1 },
  xl: { 1: 10, 2: 9, 3: 8, 4: 7, 5: 5, 6: 4, 7: 3, 8: 2, 9: 1 },
};

// Get current breakpoint based on window width
function getCurrentBreakpoint(): 'base' | 'md' | 'lg' | 'xl' {
  if (typeof window === 'undefined') return 'base';
  const width = window.innerWidth;
  if (width >= 1280) return 'xl';
  if (width >= 1024) return 'lg';
  if (width >= 768) return 'md';
  return 'base';
}

// Get column count for a size at current breakpoint
function getColumnCount(size: number, breakpoint: 'base' | 'md' | 'lg' | 'xl'): number {
  return columnMap[breakpoint][size as keyof typeof columnMap.base];
}

// Find next size that produces a visible column change
function findNextVisibleSize(currentSize: number, direction: 'in' | 'out'): number {
  const breakpoint = getCurrentBreakpoint();
  const currentCols = getColumnCount(currentSize, breakpoint);

  if (direction === 'in') {
    // Zoom in: increase size (fewer columns, bigger cards)
    for (let size = currentSize + 1; size <= 9; size++) {
      const cols = getColumnCount(size, breakpoint);
      if (cols < currentCols) {
        return size;
      }
    }
    return 9; // Max boundary
  } else {
    // Zoom out: decrease size (more columns, smaller cards)
    for (let size = currentSize - 1; size >= 1; size--) {
      const cols = getColumnCount(size, breakpoint);
      if (cols > currentCols) {
        return size;
      }
    }
    return 1; // Min boundary
  }
}

export function CardSizeControls({ size, onSizeChange }: CardSizeControlsProps) {
  const handleZoomOut = () => {
    const nextSize = findNextVisibleSize(size, 'out');
    if (nextSize !== size) {
      onSizeChange(nextSize);
    }
  };

  const handleZoomIn = () => {
    const nextSize = findNextVisibleSize(size, 'in');
    if (nextSize !== size) {
      onSizeChange(nextSize);
    }
  };

  // Check if zoom buttons should be disabled
  const canZoomOut = findNextVisibleSize(size, 'out') !== size;
  const canZoomIn = findNextVisibleSize(size, 'in') !== size;

  return (
    <div className="flex items-center gap-1">
      {/* Zoom Out Button */}
      <button
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Zoom In Button */}
      <button
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </div>
  );
}
