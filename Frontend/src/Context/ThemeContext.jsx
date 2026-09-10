import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "intime-theme";

// Light is the app's default regardless of the OS/browser preference --
// most of the app (admin + employee dashboards) isn't styled for dark mode
// yet, so only an explicit, previously-saved choice should switch it.
function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") {
    localStorage.setItem(STORAGE_KEY, "light");
  }
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
