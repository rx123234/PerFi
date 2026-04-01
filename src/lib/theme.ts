type Theme = "dark" | "light";

const STORAGE_KEY = "perfi-theme";

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme(): Theme {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// Initialize theme from localStorage on load
export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute("data-theme", theme);
}
