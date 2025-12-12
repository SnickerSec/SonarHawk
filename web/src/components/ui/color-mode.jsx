'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ColorModeContext = createContext({
  colorMode: 'dark',
  setColorMode: () => {},
  toggleColorMode: () => {},
});

export function ColorModeProvider({ children }) {
  const [colorMode, setColorMode] = useState('dark');

  useEffect(() => {
    // Check system preference or localStorage
    const stored = localStorage.getItem('chakra-ui-color-mode');
    if (stored) {
      setColorMode(stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setColorMode('light');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('chakra-ui-color-mode', colorMode);
    document.documentElement.setAttribute('data-theme', colorMode);
  }, [colorMode]);

  const toggleColorMode = () => {
    setColorMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ColorModeContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function useColorModeValue(light, dark) {
  const { colorMode } = useColorMode();
  return colorMode === 'light' ? light : dark;
}
