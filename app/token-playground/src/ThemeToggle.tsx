import type { Component } from "solid-js";

export type Theme = "light" | "dark";

export const ThemeToggle: Component<{
  theme: Theme;
  onChange: (theme: Theme) => void;
}> = (props) => {
  const isDark = () => props.theme === "dark";
  return (
    <button
      type="button"
      aria-label={isDark() ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark()}
      title={isDark() ? "Light theme" : "Dark theme"}
      onClick={() => props.onChange(isDark() ? "light" : "dark")}
      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      {isDark() ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
