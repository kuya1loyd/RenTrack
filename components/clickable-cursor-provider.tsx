"use client";

import { useEffect } from "react";

/**
 * ClickableCursorProvider
 * Automatically ensures that any interactive or clickable element in the application
 * displays the pointing hand cursor (cursor: pointer) on hover, including custom
 * divs, cards, table rows, and tags with React onClick listeners.
 */
export default function ClickableCursorProvider() {
  useEffect(() => {
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLElement)) return;

      // Preserve native text cursor on text input and editable fields
      const tagName = target.tagName;
      if (
        (tagName === "INPUT" && !["button", "submit", "reset", "checkbox", "radio", "file", "image", "range"].includes((target as HTMLInputElement).type)) ||
        tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Check element and up to 4 ancestors
      let current: HTMLElement | null = target;
      let depth = 0;

      while (current && depth < 5 && current !== document.body && current !== document.documentElement) {
        if (current.hasAttribute("data-clickable")) break;

        // Skip standard clickable elements which are already styled via global CSS
        if (
          current.tagName === "BUTTON" ||
          current.tagName === "A" ||
          current.tagName === "SELECT" ||
          current.tagName === "SUMMARY" ||
          current.tagName === "LABEL"
        ) {
          break;
        }

        // Check disabled state
        if (
          current.hasAttribute("disabled") ||
          current.getAttribute("aria-disabled") === "true" ||
          current.classList.contains("disabled")
        ) {
          break;
        }

        // Check if element has interactive properties
        let isClickable = false;

        if (
          typeof current.onclick === "function" ||
          current.getAttribute("role") === "button" ||
          current.classList.contains("cursor-pointer") ||
          current.hasAttribute("data-radix-collection-item")
        ) {
          isClickable = true;
        } else {
          // Check React synthetic event listeners on fiber / props
          const keys = Object.keys(current);
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key.startsWith("__reactProps$") || key.startsWith("__reactFiber$")) {
              const props = (current as any)[key];
              if (
                props?.onClick ||
                props?.onPointerDown ||
                props?.memoizedProps?.onClick ||
                props?.memoizedProps?.onPointerDown
              ) {
                isClickable = true;
                break;
              }
            }
          }
        }

        if (isClickable) {
          current.setAttribute("data-clickable", "true");
          break;
        }

        current = current.parentElement;
        depth++;
      }
    };

    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  return null;
}
