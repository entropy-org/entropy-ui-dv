import { DATA_VIEWS_PACKAGE_VERSION } from "@entropy-ui/data-views/server"
import { ClientViews } from "./views"

export default function Page() {
  return <main><p>SSR import: {DATA_VIEWS_PACKAGE_VERSION}</p><ClientViews /></main>
}
