"use client"

import { cn } from "@/lib/utils"

interface CoffeeSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  showText?: boolean
  text?: string
}

export function CoffeeSpinner({
  size = "md",
  className,
  showText = true,
  text = "Brewing...",
}: CoffeeSpinnerProps) {
  const sizeClasses = {
    sm: "w-16 h-20",
    md: "w-24 h-32",
    lg: "w-32 h-44",
  }

  const cupSizes = {
    sm: { cup: "w-12 h-10", handle: "w-3 h-5", liquid: "h-6" },
    md: { cup: "w-16 h-14", handle: "w-4 h-7", liquid: "h-8" },
    lg: { cup: "w-20 h-18", handle: "w-5 h-9", liquid: "h-10" },
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        {/* Coffee Pour Stream */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="relative">
            {/* Pouring coffee drops */}
            <div className="flex gap-0.5">
              <div
                className="w-1 bg-coffee-dark rounded-full animate-pour-1"
                style={{ height: size === "lg" ? "20px" : size === "md" ? "16px" : "12px" }}
              />
              <div
                className="w-1.5 bg-coffee-medium rounded-full animate-pour-2"
                style={{ height: size === "lg" ? "28px" : size === "md" ? "22px" : "16px" }}
              />
              <div
                className="w-1 bg-coffee-dark rounded-full animate-pour-3"
                style={{ height: size === "lg" ? "20px" : size === "md" ? "16px" : "12px" }}
              />
            </div>
            {/* Dripping drops */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-1 h-1 bg-coffee-dark rounded-full animate-drip-1" />
              <div className="w-1.5 h-1.5 bg-coffee-medium rounded-full animate-drip-2" />
              <div className="w-1 h-1 bg-coffee-dark rounded-full animate-drip-3" />
            </div>
          </div>
        </div>

        {/* Coffee Cup */}
        <div
          className={cn(
            "absolute bottom-0 left-1/2 -translate-x-1/2",
            cupSizes[size].cup
          )}
        >
          {/* Cup Body */}
          <div className="relative w-full h-full">
            <div className="absolute inset-0 bg-cream rounded-b-2xl border-2 border-coffee-light shadow-lg overflow-hidden">
              {/* Coffee liquid filling animation */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 bg-coffee-medium animate-fill rounded-b-xl",
                  cupSizes[size].liquid
                )}
              >
                {/* Coffee surface shimmer */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-coffee-light/50 animate-shimmer" />
                {/* Ripple effect */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-coffee-light/30 rounded-full animate-ripple" />
              </div>
            </div>

            {/* Cup Handle */}
            <div
              className={cn(
                "absolute top-1/2 -right-3 -translate-y-1/2 border-2 border-coffee-light rounded-r-full bg-cream",
                cupSizes[size].handle
              )}
            />

            {/* Steam wisps */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-0.5 h-3 bg-steam/60 rounded-full animate-steam-1" />
              <div className="w-0.5 h-4 bg-steam/40 rounded-full animate-steam-2" />
              <div className="w-0.5 h-3 bg-steam/60 rounded-full animate-steam-3" />
            </div>
          </div>
        </div>
      </div>

      {showText && (
        <p className="text-muted-foreground font-medium tracking-wide animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}
