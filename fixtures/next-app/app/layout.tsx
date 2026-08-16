import type { ReactNode } from "react"
import "@entropy-ui/data-views/styles.css"

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
