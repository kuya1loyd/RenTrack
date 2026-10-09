"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs>");
  return ctx;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-surface-tertiary p-1 text-text-secondary",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: activeTab, onValueChange } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 cursor-pointer",
        isActive
          ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
          : "hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: activeTab } = useTabs();
  if (activeTab !== value) return null;

  return (
    <div
      className={"mt-4 " + (className || "")}
    >
      {children}
    </div>
  );
}
