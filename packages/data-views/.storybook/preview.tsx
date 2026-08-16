import type { Preview } from "@storybook/react-vite";
import {
  DataViewThemeProvider,
  type DataViewThemeMode,
} from "../src/core/theme.js";
import "@fontsource-variable/ibm-plex-sans";
import "../src/styles/index.css";

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Theme applied to every data-view example",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
          { value: "system", title: "System", icon: "browser" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    docs: {
      codePanel: true,
    },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    options: {
      storySort: {
        order: ["Introduction", "Core", "Components"],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <DataViewThemeProvider
        theme={(context.globals.theme ?? "dark") as DataViewThemeMode}
        tokens={{
          fontSans: "'IBM Plex Sans Variable', sans-serif",
          fontHeading: "'IBM Plex Sans Variable', sans-serif",
        }}
        className="min-h-screen bg-background text-foreground"
      >
        <Story />
      </DataViewThemeProvider>
    ),
  ],
};

export default preview;
