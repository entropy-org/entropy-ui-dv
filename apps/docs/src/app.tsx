import { useEffect, useState, type ReactNode } from "react"
import { DataViewThemeProvider } from "@entropy-ui/data-views"
import {
  CalendarExample,
  DatabaseExample,
  KanbanExample,
  ListExample,
  TimelineExample,
} from "./examples"

const VIEW_TABS = ["list", "kanban", "calendar", "timeline"] as const
type ViewTab = (typeof VIEW_TABS)[number]

const CODE = `import { DatabaseViews, createSavedDataView } from "@entropy-ui/data-views"
import { createBuiltInDataViewPlugins } from "@entropy-ui/data-views/adapters"
import "@entropy-ui/data-views/styles.css"

<DatabaseViews
  source={{ mode: "client", id: "work", records }}
  schema={schema}
  views={views}
  activeViewId={activeViewId}
  onActiveViewIdChange={setActiveViewId}
  onViewsChange={setViews}
  plugins={createBuiltInDataViewPlugins()}
  onIntent={handleIntent}
/>`

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function CopyButton({ text }: { readonly text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="copy-button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly copy: string
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  )
}

function OwnershipCard({
  number,
  title,
  children,
}: {
  readonly number: string
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <article className="ownership-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("edv-docs-theme") === "dark" ? "dark" : "light",
  )
  const [engine, setEngine] = useState<ViewTab>("list")

  useEffect(() => {
    document.documentElement.classList.toggle("site-dark", theme === "dark")
    localStorage.setItem("edv-docs-theme", theme)
  }, [theme])

  const engineExample =
    engine === "list" ? (
      <ListExample />
    ) : engine === "kanban" ? (
      <KanbanExample />
    ) : engine === "calendar" ? (
      <CalendarExample />
    ) : (
      <TimelineExample />
    )

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top">
          <Mark />
          <span>
            Entropy <b>Data Views</b>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#examples">Examples</a>
          <a href="#ownership">Architecture</a>
          <a href="#theming">Theming</a>
          <a href="#install">Install</a>
        </nav>
        <div className="header-actions">
          <button
            className="theme-button"
            aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
            onClick={() =>
              setTheme((current) => (current === "light" ? "dark" : "light"))
            }
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <a
            className="github-button"
            href="https://github.com/entropy-org/entropy-ui-dv"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> Open source · React 18 & 19
            </p>
            <h1>
              One dataset.
              <br />
              <em>Every useful view.</em>
            </h1>
            <p className="hero-lead">
              A controlled component library for building Notion-inspired
              databases—without surrendering your data, forms, or design system.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#install">
                Get started <span>→</span>
              </a>
              <a className="text-button" href="#examples">
                Explore the views ↓
              </a>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>4</dt>
                <dd>built-in views</dd>
              </div>
              <div>
                <dt>0</dt>
                <dd>data assumptions</dd>
              </div>
              <div>
                <dt>100%</dt>
                <dd>controlled</dd>
              </div>
            </dl>
          </div>
          <div className="hero-preview">
            <div className="preview-label">
              <span>LIVE PREVIEW</span>
              <span>Interactive</span>
            </div>
            <DatabaseExample theme={theme} />
          </div>
        </section>

        <section className="principles-strip" aria-label="Library principles">
          <span>Composable by default</span>
          <span>Consumer-owned state</span>
          <span>Accessible interactions</span>
          <span>Server-ready contracts</span>
        </section>

        <section className="section" id="examples">
          <SectionHeading
            eyebrow="The engines"
            title="Pick a perspective, not a new data model."
            copy="Use an engine on its own or let DatabaseViews coordinate saved perspectives. Every preview below consumes the package's public API."
          />
          <div
            className="engine-switcher"
            role="tablist"
            aria-label="Data view examples"
          >
            {VIEW_TABS.map((view) => (
              <button
                key={view}
                role="tab"
                aria-selected={engine === view}
                onClick={() => setEngine(view)}
              >
                <span className={`engine-icon ${view}`} />
                {view}
              </button>
            ))}
          </div>
          <div className={`engine-preview engine-${engine}`}>
            <div className="engine-meta">
              <div>
                <span>STANDALONE ENGINE</span>
                <h3>{engine[0].toUpperCase() + engine.slice(1)} view</h3>
              </div>
              <p>
                {engine === "list"
                  ? "Searchable, sortable rows with grouping and selection."
                  : engine === "kanban"
                    ? "Controlled cards, optimistic moves, WIP limits, and swimlanes."
                    : engine === "calendar"
                      ? "Month and agenda modes with timezone-safe ranges."
                      : "Virtualized planning with drag, resize, hierarchy, and dependencies."}
              </p>
            </div>
            <div className="engine-canvas">
              <DataViewThemeProvider theme={theme} className="engine-theme">
                {engineExample}
              </DataViewThemeProvider>
            </div>
          </div>
        </section>

        <section className="section ownership-section" id="ownership">
          <SectionHeading
            eyebrow="A clean boundary"
            title="The library owns interaction. You own truth."
            copy="Built for real applications where records come from APIs, permissions matter, and UI state must never become a second database."
          />
          <div className="ownership-grid">
            <OwnershipCard number="01" title="Your source">
              Records stay in your query cache or application state. Pass
              snapshots in; receive typed intents out.
            </OwnershipCard>
            <OwnershipCard number="02" title="Your saved views">
              Persist view names, filters, sorts, grouping, and the active id
              wherever your product needs them.
            </OwnershipCard>
            <OwnershipCard number="03" title="Your forms">
              Create and edit flows are controlled. Use the included fields or
              bring your validation, routing, and mutation stack.
            </OwnershipCard>
            <OwnershipCard number="04" title="Our interactions">
              Focus, keyboard behavior, dragging, resizing, selection,
              virtualized surfaces, and accessible announcements are built in.
            </OwnershipCard>
          </div>
          <div className="flow-diagram">
            <div>
              <small>YOUR APP</small>
              <strong>Records + query cache</strong>
            </div>
            <b>→</b>
            <div className="flow-core">
              <small>DATA VIEWS</small>
              <strong>Schema + saved view</strong>
            </div>
            <b>→</b>
            <div>
              <small>YOUR APP</small>
              <strong>Typed mutation intent</strong>
            </div>
          </div>
        </section>

        <section className="section theme-section" id="theming">
          <div>
            <SectionHeading
              eyebrow="Designed to belong"
              title="Scoped themes, stable parts, zero host Tailwind required."
              copy="Import one compiled stylesheet. Semantic --edv-* tokens inherit from common host variables and can be overridden per provider."
            />
            <div className="token-row">
              <span style={{ background: "#ff6b4a" }} />
              <span style={{ background: "#f3d453" }} />
              <span style={{ background: "#4fb98b" }} />
              <span style={{ background: "#5d7fe7" }} />
              <span style={{ background: "#a775e8" }} />
            </div>
          </div>
          <pre className="theme-code">
            <code>{`<DataViewThemeProvider
  theme="dark"
  tokens={{
    primary: "oklch(0.68 0.18 35)",
    radius: "0.75rem",
    fontSans: "Inter, sans-serif",
  }}
>
  <DatabaseViews {...props} />
</DataViewThemeProvider>`}</code>
          </pre>
        </section>

        <section className="section install-section" id="install">
          <div className="install-copy">
            <p className="eyebrow">Start composing</p>
            <h2>From install to four views in minutes.</h2>
            <p>
              The prerelease is public on npm. Pin the version while the API is
              in its acceptance window.
            </p>
            <div className="install-command">
              <code>npm install @entropy-ui/data-views@next</code>
              <CopyButton text="npm install @entropy-ui/data-views@next" />
            </div>
            <div className="install-links">
              <a href="https://www.npmjs.com/package/@entropy-ui/data-views">
                View on npm ↗
              </a>
              <a href="https://github.com/entropy-org/entropy-ui-dv/tree/main/docs">
                Read the deep-dive guides ↗
              </a>
            </div>
          </div>
          <div className="code-window">
            <div className="code-toolbar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <b>workspace.tsx</b>
              <CopyButton text={CODE} />
            </div>
            <pre>
              <code>{CODE}</code>
            </pre>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#top">
          <Mark />
          <span>
            Entropy <b>Data Views</b>
          </span>
        </a>
        <p>
          MIT licensed. Built for the views your product hasn't imagined yet.
        </p>
        <div>
          <a href="https://github.com/entropy-org/entropy-ui-dv">Source</a>
          <a href="https://www.npmjs.com/package/@entropy-ui/data-views">npm</a>
          <a href="https://github.com/entropy-org/entropy-ui-dv/issues">
            Issues
          </a>
        </div>
      </footer>
    </div>
  )
}
