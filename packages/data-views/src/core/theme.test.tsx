import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DataViewThemeProvider } from "./theme.js"

describe("DataViewThemeProvider", () => {
  it("scopes mode, tokens, and a portal target", () => {
    render(
      <DataViewThemeProvider
        data-testid="theme"
        theme="dark"
        tokens={{ primary: "rebeccapurple", radius: "1rem" }}
      >
        Content
      </DataViewThemeProvider>
    )
    const theme = screen.getByTestId("theme")
    expect(theme).toHaveAttribute("data-edv-theme", "dark")
    expect(theme.style.getPropertyValue("--edv-primary")).toBe("rebeccapurple")
    expect(theme.querySelector("[data-edv-portal-root]")).not.toBeNull()
  })
})
