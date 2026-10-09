"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary-600 text-white shadow-lg shadow-primary-600/25 hover:bg-primary-700 hover:shadow-primary-600/40 active:scale-[0.97]",
        destructive:
          "bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-700 active:scale-[0.97]",
        outline:
          "border border-border bg-surface text-text-primary hover:bg-surface-secondary hover:border-primary-300 active:scale-[0.97]",
        secondary:
          "bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary active:scale-[0.97]",
        ghost:
          "text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:scale-[0.97]",
        link: "text-primary-600 underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-primary-600 to-secondary-500 text-white shadow-lg shadow-primary-600/25 hover:shadow-primary-600/40 hover:from-primary-700 hover:to-secondary-600 active:scale-[0.97]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const MotionButton = motion.button;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : MotionButton;

    // Only add motion props if not asChild
    const motionProps = asChild
      ? {}
      : {
          whileHover: { scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 17 } },
        };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...motionProps}
        {...(props as any)}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

