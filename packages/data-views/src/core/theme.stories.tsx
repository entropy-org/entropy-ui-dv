import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  DataViewThemeProvider,
  type DataViewThemeProviderProps,
} from "./theme.js";

const oceanTokens = {
  background: "#f5fbff",
  foreground: "#10283b",
  card: "#ffffff",
  cardForeground: "#10283b",
  primary: "#005a7a",
  primaryForeground: "#ffffff",
  secondary: "#dbeef5",
  secondaryForeground: "#17394a",
  muted: "#e8f2f6",
  mutedForeground: "#3c5865",
  accent: "#c9e8f2",
  accentForeground: "#10283b",
  border: "#aac4ce",
  input: "#aac4ce",
  ring: "#005a7a",
  radius: "1rem",
} as const;

type ThemePreviewProps = Pick<DataViewThemeProviderProps, "theme" | "tokens">;

const ThemePreview = React.memo(
  React.forwardRef<HTMLDivElement, ThemePreviewProps>(function ThemePreview(
    { theme, tokens },
    ref,
  ) {
    return (
      <DataViewThemeProvider
        ref={ref}
        theme={theme}
        tokens={tokens}
        className="min-h-96 bg-background p-8 text-foreground"
      >
        <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Product database</p>
              <h2 className="mt-1 font-heading text-xl font-semibold">
                Scoped theme preview
              </h2>
            </div>
            <Badge variant="secondary">12 records</Badge>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Backlog", "5"],
              ["In progress", "4"],
              ["Done", "3"],
            ].map(([label, count]) => (
              <div key={label} className="rounded-lg border bg-muted p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button>Add record</Button>
            <Button variant="outline">Configure view</Button>
          </div>
        </div>
      </DataViewThemeProvider>
    );
  }),
);

const meta = {
  title: "Core/Theming",
  component: DataViewThemeProvider,
  parameters: {
    docs: {
      description: {
        component:
          "DataViewThemeProvider scopes light, dark, or system mode and semantic token overrides to one data-view tree, including portaled overlays.",
      },
    },
  },
} satisfies Meta<typeof DataViewThemeProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  render: () => <ThemePreview theme="light" />,
};

export const Dark: Story = {
  render: () => <ThemePreview theme="dark" />,
};

export const CustomTokens: Story = {
  render: () => <ThemePreview theme="light" tokens={oceanTokens} />,
  parameters: {
    docs: {
      description: {
        story:
          "Override only the semantic tokens your product owns. All remaining tokens continue to use library or host defaults.",
      },
    },
  },
};

export const IndependentlyScoped: Story = {
  render: () => (
    <div className="grid min-h-screen gap-4 bg-neutral-200 p-4 xl:grid-cols-2">
      <ThemePreview theme="light" tokens={oceanTokens} />
      <ThemePreview theme="dark" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Multiple data-view trees can use independent themes on the same application page.",
      },
    },
  },
};

export const NestedSurfacesInheritTokens: Story = {
  render: () => (
    <DataViewThemeProvider
      theme="dark"
      tokens={{
        background: "#09090b",
        foreground: "#f4f4f5",
        primary: "#f59e0b",
      }}
      className="min-h-96 bg-background p-8 text-foreground"
      data-nested-theme="outer"
    >
      <div
        className="edv-root rounded-xl border bg-background p-6 text-foreground"
        data-edv-root=""
        data-nested-theme="inner"
      >
        Nested view surface
      </div>
    </DataViewThemeProvider>
  ),
  play: ({ canvasElement }) => {
    const outer = canvasElement.querySelector<HTMLElement>(
      '[data-nested-theme="outer"]',
    );
    const inner = canvasElement.querySelector<HTMLElement>(
      '[data-nested-theme="inner"]',
    );

    if (!outer || !inner)
      throw new Error("Nested theme fixture did not render");

    const outerStyle = getComputedStyle(outer);
    const innerStyle = getComputedStyle(inner);
    for (const token of [
      "--edv-background",
      "--edv-foreground",
      "--edv-primary",
    ]) {
      if (
        innerStyle.getPropertyValue(token) !==
        outerStyle.getPropertyValue(token)
      ) {
        throw new Error(`${token} was reset by a nested data-view root`);
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "Nested list, kanban, calendar, and timeline roots inherit the nearest provider tokens instead of resetting to light defaults.",
      },
    },
  },
};
