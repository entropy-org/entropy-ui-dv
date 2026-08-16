import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@entropy-ui/data-views/styles.css"
import { App } from "./app"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
