import type { Component } from "solid-js";
import type { TokenMode } from "./tokens";

// A pair of segmented buttons for choosing which token-mode's values the
// KitchenSink renders (light / dark). Intentionally separate from the
// app-chrome ThemeToggle: the two can be mixed, e.g. light app chrome
// previewing dark-scheme token values.
export const SchemeToggle: Component<{
  mode: TokenMode;
  onChange: (mode: TokenMode) => void;
}> = (props) => {
  const baseBtn =
    "px-2 py-1 text-xs font-medium transition-colors focus:outline-none";
  const activeBtn =
    "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900";
  const inactiveBtn =
    "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700";

  const classesFor = (value: TokenMode) =>
    `${baseBtn} ${props.mode === value ? activeBtn : inactiveBtn}`;

  return (
    <div
      class="inline-flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
      role="group"
      aria-label="Token color scheme"
    >
      <button
        type="button"
        aria-pressed={props.mode === "light"}
        class={classesFor("light")}
        onClick={() => props.onChange("light")}
      >
        Light
      </button>
      <button
        type="button"
        aria-pressed={props.mode === "dark"}
        class={classesFor("dark")}
        onClick={() => props.onChange("dark")}
      >
        Dark
      </button>
    </div>
  );
};

export default SchemeToggle;
