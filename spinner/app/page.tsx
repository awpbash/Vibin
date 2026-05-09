"use client"

import { useState } from "react"
import { CoffeeSpinner } from "@/components/coffee-spinner"
import { Button } from "@/components/ui/button"

export default function CoffeeSpinnerDemo() {
  const [activeSize, setActiveSize] = useState<"sm" | "md" | "lg">("md")
  const [customText, setCustomText] = useState("Brewing...")
  const [showText, setShowText] = useState(true)

  const textOptions = [
    "Brewing...",
    "Preparing your order...",
    "Almost ready...",
    "Loading...",
    "Please wait...",
  ]

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary via-background to-background" />
        
        <div className="relative container mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground tracking-tight mb-4">
              Coffee Spinner
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A delightful coffee-themed loading animation for your next project. 
              Perfect for cafes, coffee apps, and cozy interfaces.
            </p>
          </div>

          {/* Main Demo */}
          <div className="flex justify-center mb-16">
            <div className="bg-card rounded-3xl shadow-xl p-12 border border-border">
              <CoffeeSpinner 
                size={activeSize} 
                text={customText}
                showText={showText}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="max-w-xl mx-auto space-y-8">
            {/* Size Controls */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Size</label>
              <div className="flex gap-3">
                {(["sm", "md", "lg"] as const).map((size) => (
                  <Button
                    key={size}
                    variant={activeSize === size ? "default" : "outline"}
                    onClick={() => setActiveSize(size)}
                    className="flex-1"
                  >
                    {size.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Text Controls */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Loading Text</label>
              <div className="flex flex-wrap gap-2">
                {textOptions.map((text) => (
                  <Button
                    key={text}
                    variant={customText === text ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCustomText(text)}
                  >
                    {text}
                  </Button>
                ))}
              </div>
            </div>

            {/* Toggle Text */}
            <div className="flex items-center gap-3">
              <Button
                variant={showText ? "default" : "outline"}
                onClick={() => setShowText(!showText)}
              >
                {showText ? "Hide Text" : "Show Text"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* All Sizes Showcase */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            All Sizes
          </h2>
          
          <div className="flex flex-wrap justify-center items-end gap-16">
            <div className="flex flex-col items-center gap-4">
              <CoffeeSpinner size="sm" text="Small" />
              <span className="text-sm text-muted-foreground font-medium">sm</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <CoffeeSpinner size="md" text="Medium" />
              <span className="text-sm text-muted-foreground font-medium">md</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <CoffeeSpinner size="lg" text="Large" />
              <span className="text-sm text-muted-foreground font-medium">lg</span>
            </div>
          </div>
        </div>
      </section>

      {/* Usage Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Usage Examples
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Card Loading */}
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <div className="flex flex-col items-center justify-center h-48">
                <CoffeeSpinner size="sm" text="Loading menu..." />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Card Loading State
              </p>
            </div>

            {/* Page Loading */}
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <div className="flex flex-col items-center justify-center h-48">
                <CoffeeSpinner size="md" text="Preparing your order..." />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Page Loading State
              </p>
            </div>

            {/* Fullscreen Loading */}
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <div className="flex flex-col items-center justify-center h-48">
                <CoffeeSpinner size="sm" showText={false} />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Minimal Icon Only
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-6 text-center">
          <p className="text-muted-foreground">
            Best served often ☕
          </p>
        </div>
      </footer>
    </main>
  )
}
