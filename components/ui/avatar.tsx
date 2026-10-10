"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({
  src,
  alt = "",
  fallback = "U",
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const [error, setError] = React.useState(false);
  const normalizedSrc = src && src.trim() ? src.trim() : null;
  const isLocalRoute = !!normalizedSrc && !/^https?:\/\//i.test(normalizedSrc) && !normalizedSrc.startsWith("//");
  const isUploadRoute = !!normalizedSrc && /(\/api\/auth\/upload\/|\/api\/auth\/upload$)/.test(normalizedSrc);
  const sizeClass = (size && sizeMap[size as keyof typeof sizeMap]) || sizeMap.md;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-800",
        sizeClass,
        className
      )}
      {...props}
    >
      {normalizedSrc && !error ? (
        <Image
          src={normalizedSrc}
          alt={alt}
          width={80}
          height={80}
          unoptimized={isLocalRoute || isUploadRoute || /^https?:\/\/localhost(?::\d+)?\//i.test(normalizedSrc)}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 font-semibold text-white">
          {fallback}
        </div>
      )}
    </div>
  );
}
