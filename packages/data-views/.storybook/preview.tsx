import type { Preview } from "@storybook/react-vite"
import { DataViewThemeProvider } from "../src/core/theme.js"
import "../src/styles/index.css"

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
  decorators: [
    (Story) => (
      <DataViewThemeProvider className="min-h-screen bg-background p-6 text-foreground">
        <Story />
      </DataViewThemeProvider>
    ),
  ],
}

export default preview
