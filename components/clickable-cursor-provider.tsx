"use client";

/**
 * ClickableCursorProvider
 * Native CSS in app/globals.css handles cursor: pointer on all true interactive elements
 * (buttons, links, selects, labels, [role="button"], and .cursor-pointer).
 * Dynamic DOM tree inspection is disabled to prevent non-clickable panels, motion divs,
 * and containers from showing fake clickable hand cursors.
 */
export default function ClickableCursorProvider() {
  return null;
}
