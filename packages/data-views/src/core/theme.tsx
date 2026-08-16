"use client"

import React, { createContext, useContext, useRef } from "react"
import { cn } from "../lib/utils.js"

export type DataViewThemeMode = "light" | "dark" | "system"

export interface DataViewThemeTokens {
  readonly background: string
  readonly foreground: string
  readonly card: string
  readonly cardForeground: string
  readonly popover: string
  readonly popoverForeground: string
  readonly primary: string
  readonly primaryForeground: string
  readonly secondary: string
  readonly secondaryForeground: string
  readonly muted: string
  readonly mutedForeground: string
  readonly accent: string
  readonly accentForeground: string
  readonly destructive: string
  readonly border: string
  readonly input: string
  readonly ring: string
  readonly success: string
  readonly warning: string
  readonly info: string
  readonly radius: string
  readonly fontSans: string
  readonly fontHeading: string
}

const TOKEN_NAMES: Readonly<Record<keyof DataViewThemeTokens, string>> = {
  background: "--edv-background",
  foreground: "--edv-foreground",
  card: "--edv-card",
  cardForeground: "--edv-card-foreground",
  popover: "--edv-popover",
  popoverForeground: "--edv-popover-foreground",
  primary: "--edv-primary",
  primaryForeground: "--edv-primary-foreground",
  secondary: "--edv-secondary",
  secondaryForeground: "--edv-secondary-foreground",
  muted: "--edv-muted",
  mutedForeground: "--edv-muted-foreground",
  accent: "--edv-accent",
  accentForeground: "--edv-accent-foreground",
  destructive: "--edv-destructive",
  border: "--edv-border",
  input: "--edv-input",
  ring: "--edv-ring",
  success: "--edv-success",
  warning: "--edv-warning",
  info: "--edv-info",
  radius: "--edv-radius",
  fontSans: "--edv-font-sans",
  fontHeading: "--edv-font-heading",
}

type PortalContainer = React.RefObject<HTMLDivElement | null>
const DataViewPortalContext = createContext<PortalContainer | null>(null)

export function useDataViewPortalContainer() {
  return useContext(DataViewPortalContext)
}

export type DataViewThemeProviderProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "color"
> & {
  readonly theme?: DataViewThemeMode
  readonly tokens?: Partial<DataViewThemeTokens>
}

function getTokenStyle(
  tokens: Partial<DataViewThemeTokens> | undefined,
  style: React.CSSProperties | undefined
) {
  const resolved: Record<string, string | number | undefined> = { ...style }
  if (tokens) {
    for (const [key, value] of Object.entries(tokens) as Array<
      [keyof DataViewThemeTokens, string]
    >) {
      resolved[TOKEN_NAMES[key]] = value
    }
  }
  return resolved as React.CSSProperties
}

/** Provides scoped design tokens and a theme-preserving target for portals. */
export const DataViewThemeProvider = React.memo(
  React.forwardRef<HTMLDivElement, DataViewThemeProviderProps>(
    function DataViewThemeProvider(
      {
        theme = "system",
        tokens,
        className,
        style,
        children,
        ...props
      },
      ref
    ) {
      const portalContainer = useRef<HTMLDivElement>(null)
      return (
        <DataViewPortalContext.Provider value={portalContainer}>
          <div
            ref={ref}
            className={cn("edv-root", className)}
            data-edv-root=""
            data-edv-theme={theme === "system" ? undefined : theme}
            style={getTokenStyle(tokens, style)}
            {...props}
          >
            {children}
            <div ref={portalContainer} data-edv-portal-root="" />
          </div>
        </DataViewPortalContext.Provider>
      )
    }
  )
)
