import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import { DocumentEditor } from "@templara/editor";
import type { DocumentTemplate } from "@templara/core";
import {
  invoiceSampleData,
  invoiceTemplate,
  payStubSampleData,
  payStubTemplate,
  receiptSampleData,
  receiptTemplate,
  shipmentBolSampleData,
  shipmentBolTemplate,
  shippingLabelSampleData,
  shippingLabelTemplate,
} from "@templara/templates";
import {
  cloneProject,
  createInitialProjectStore,
  createProjectFromSeed,
  importProjectBundle,
  isProjectDirty,
  loadProjectStore,
  markProjectSaved,
  safeProjectFileName,
  saveProjectStore,
  serializeProjectBundle,
} from "./projects";
import type { TemplateSeed, TemplaraProject, TemplaraProjectStore } from "./projects";

const LETTER_PAGE_SIZE = {
  width: 816,
  height: 1056
};

const blankTemplate: DocumentTemplate = {
  id: "blank-document",
  version: "0.1.0",
  unit: "px",
  metadata: {
    name: "Blank Document",
    description: "A blank Letter-size document for starting from scratch."
  },
  pages: [
    {
      id: "page-1",
      name: "Page 1",
      size: LETTER_PAGE_SIZE,
      margin: {
        top: 48,
        right: 48,
        bottom: 48,
        left: 48
      },
      layers: [
        {
          id: "fixed",
          kind: "fixed",
          nodes: []
        },
        {
          id: "flow",
          kind: "flow",
          nodes: []
        }
      ]
    }
  ],
  fonts: [
    {
      id: "geist-sans",
      family: "Geist",
      source: {
        kind: "google-font",
        family: "Geist",
        weights: [400, 500, 600, 700],
        display: "swap"
      },
      fallback: "Inter, ui-sans-serif, system-ui, sans-serif"
    },
    {
      id: "geist-mono",
      family: "Geist Mono",
      source: {
        kind: "google-font",
        family: "Geist Mono",
        weights: [400, 500, 600, 700],
        display: "swap"
      },
      fallback: "ui-monospace, SFMono-Regular, Menlo, monospace"
    }
  ]
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  { id: "blank", label: "Blank", template: blankTemplate, data: {} },
  { id: "invoice", label: "Invoice", template: invoiceTemplate, data: invoiceSampleData },
  { id: "shipment-bol", label: "Shipment BOL", template: shipmentBolTemplate, data: shipmentBolSampleData },
  { id: "receipt", label: "Receipt", template: receiptTemplate, data: receiptSampleData },
  { id: "pay-stub", label: "Pay Stub", template: payStubTemplate, data: payStubSampleData },
  { id: "shipping-label", label: "Shipping Label", template: shippingLabelTemplate, data: shippingLabelSampleData },
];

type StudioMessage = { tone: "info" | "error"; text: string } | null;
type StudioScreen = "dashboard" | "editor";

const DOCS_APP_URL = "http://localhost:5174/";
const DOC_LINKS = [
  {
    label: "Package docs",
    href: DOCS_APP_URL,
    description: "Install, embed, render, export, validate, and migrate Templara packages.",
  },
  {
    label: "Editor concepts",
    href: `${DOCS_APP_URL}#editor`,
    description: "How DocumentEditor stays separate from preview, pagination, and export.",
  },
  {
    label: "Renderer API",
    href: `${DOCS_APP_URL}#render`,
    description: "How templates and data become deterministic render trees.",
  },
];

const SEED_DESCRIPTIONS: Record<string, string> = {
  blank: "Start with an empty Letter-size page and build from scratch.",
  invoice: "Line items, totals, computed variables, and invoice sample data.",
  "shipment-bol": "Bill of lading layout with handling units, addresses, and codes.",
  receipt: "Compact transactional receipt with repeat rows and totals.",
  "pay-stub": "Payroll-style document with earnings, deductions, and summaries.",
  "shipping-label": "Small-format label with address blocks, barcode, and QR code.",
};

function loadInitialStore(): TemplaraProjectStore {
  return loadProjectStore(
    typeof window === "undefined" ? undefined : window.localStorage,
    TEMPLATE_SEEDS,
  );
}

function selectedProjectFromStore(store: TemplaraProjectStore): TemplaraProject {
  return cloneProject(
    store.projects.find((project) => project.id === store.selectedProjectId) ??
      store.projects[0] ??
      createInitialProjectStore(TEMPLATE_SEEDS).projects[0],
  );
}

export function App() {
  const [initialStore] = useState<TemplaraProjectStore>(() => loadInitialStore());
  const [store, setStore] = useState<TemplaraProjectStore>(() => initialStore);
  const [activeProject, setActiveProject] = useState<TemplaraProject>(() =>
    selectedProjectFromStore(initialStore),
  );
  const [screen, setScreen] = useState<StudioScreen>("dashboard");
  const [message, setMessage] = useState<StudioMessage>(null);
  const savedProject = store.projects.find((project) => project.id === activeProject.id);
  const dirty = isProjectDirty(activeProject, savedProject);

  useEffect(() => {
    saveProjectStore(
      typeof window === "undefined" ? undefined : window.localStorage,
      store,
    );
  }, [store]);

  const saveActiveProject = (
    template: DocumentTemplate = activeProject.template,
    data: Record<string, unknown> | undefined = activeProject.data,
  ): void => {
    const saved = markProjectSaved({
      ...activeProject,
      template,
      data: data ?? {},
    });

    setActiveProject(cloneProject(saved));
    setStore((current) => ({
      version: 1,
      selectedProjectId: saved.id,
      projects: upsertProject(current.projects, saved),
    }));
    setMessage({ tone: "info", text: `Saved ${saved.name}.` });
  };

  const selectProject = (
    projectId: string,
    options: { openEditor?: boolean } = { openEditor: true },
  ): void => {
    const project = store.projects.find((entry) => entry.id === projectId);

    if (!project) {
      return;
    }

    setStore((current) => ({ ...current, selectedProjectId: projectId }));
    setActiveProject(cloneProject(project));
    setMessage(null);
    if (options.openEditor ?? true) {
      setScreen("editor");
    }
  };

  const createProject = (
    seed: TemplateSeed,
    options: { openEditor?: boolean } = { openEditor: true },
  ): void => {
    const project = createProjectFromSeed(seed);

    setStore((current) => ({
      version: 1,
      selectedProjectId: project.id,
      projects: [...current.projects, project],
    }));
    setActiveProject(cloneProject(project));
    setMessage({ tone: "info", text: `Created ${project.name}.` });
    if (options.openEditor ?? true) {
      setScreen("editor");
    }
  };

  const renameProject = (): void => {
    const nextName = window.prompt("Project name", activeProject.name)?.trim();

    if (!nextName) {
      return;
    }

    setActiveProject((project) => ({
      ...project,
      name: nextName,
      template: {
        ...project.template,
        metadata: { ...project.template.metadata, name: nextName },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const duplicateProject = (): void => {
    const now = new Date().toISOString();
    const copy: TemplaraProject = {
      ...cloneProject(activeProject),
      id: createLocalProjectId(activeProject.sourceTemplateId),
      name: `${activeProject.name} Copy`,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
    };
    copy.template.metadata = { ...copy.template.metadata, name: copy.name };

    setStore((current) => ({
      version: 1,
      selectedProjectId: copy.id,
      projects: [...current.projects, copy],
    }));
    setActiveProject(cloneProject(copy));
    setMessage({ tone: "info", text: `Duplicated ${activeProject.name}.` });
  };

  const deleteProject = (): void => {
    if (store.projects.length <= 1) {
      setMessage({ tone: "error", text: "Keep at least one local project." });
      return;
    }

    if (!window.confirm(`Delete "${activeProject.name}" from local projects?`)) {
      return;
    }

    const remaining = store.projects.filter((project) => project.id !== activeProject.id);
    const next = remaining[0];

    if (!next) {
      return;
    }

    setStore({ version: 1, selectedProjectId: next.id, projects: remaining });
    setActiveProject(cloneProject(next));
    setMessage({ tone: "info", text: "Deleted local project." });
  };

  const exportProject = (): void => {
    const blob = new Blob([serializeProjectBundle(activeProject)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeProjectFileName(activeProject.name);
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProject = (contents: string): void => {
    try {
      const result = importProjectBundle(contents);
      const project = {
        ...result.project,
        id: createLocalProjectId(result.project.sourceTemplateId),
      };

      setStore((current) => ({
        version: 1,
        selectedProjectId: project.id,
        projects: [...current.projects, project],
      }));
      setActiveProject(cloneProject(project));
      setMessage({
        tone: "info",
        text: result.migrated ? "Imported and migrated project." : "Imported project.",
      });
      setScreen("editor");
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not import project.",
      });
    }
  };

  if (screen === "dashboard") {
    return (
      <StudioDashboard
        store={store}
        activeProject={activeProject}
        dirty={dirty}
        message={message}
        onOpenProject={(projectId) => selectProject(projectId, { openEditor: true })}
        onCreateProject={(seed) => createProject(seed, { openEditor: true })}
        onOpenEditor={() => setScreen("editor")}
        onImport={importProject}
      />
    );
  }

  return (
    <>
      <DocumentEditor
        key={activeProject.id}
        value={activeProject.template}
        data={activeProject.data}
        documentTitle={activeProject.name}
        documentStatus={dirty ? "dirty" : "saved"}
        onSave={saveActiveProject}
        onChange={(template) =>
          setActiveProject((project) => ({
            ...project,
            template,
            updatedAt: new Date().toISOString(),
          }))
        }
        onDataChange={(data) =>
          setActiveProject((project) => ({
            ...project,
            data,
            updatedAt: new Date().toISOString(),
          }))
        }
        toolbarAccessory={
          <EditorToolbarAccessory
            store={store}
            activeProject={activeProject}
            dirty={dirty}
            message={message}
            onBackToDashboard={() => setScreen("dashboard")}
            onSelectProject={selectProject}
            onCreateProject={createProject}
            onSave={saveActiveProject}
            onRename={renameProject}
            onDuplicate={duplicateProject}
            onDelete={deleteProject}
            onExport={exportProject}
            onImport={importProject}
          />
        }
      />
    </>
  );
}

function StudioDashboard({
  store,
  activeProject,
  dirty,
  message,
  onOpenProject,
  onCreateProject,
  onOpenEditor,
  onImport,
}: {
  store: TemplaraProjectStore;
  activeProject: TemplaraProject;
  dirty: boolean;
  message: StudioMessage;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (seed: TemplateSeed) => void;
  onOpenEditor: () => void;
  onImport: (contents: string) => void;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const projects = store.projects.map((project) =>
    project.id === activeProject.id ? activeProject : project,
  );

  const readImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onImport(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <main style={dashboardShellStyle}>
      <header style={dashboardTopbarStyle}>
        <div style={dashboardBrandGroupStyle}>
          <img src="/favicon.svg" alt="" style={dashboardLogoStyle} />
          <div>
            <div style={dashboardBrandNameStyle}>Templara</div>
            <div style={dashboardBrandMetaStyle}>Document runtime and visual authoring</div>
          </div>
        </div>
        <div style={dashboardTopActionsStyle}>
          <a href={DOCS_APP_URL} target="_blank" rel="noreferrer" style={ghostLinkButtonStyle}>
            Docs
          </a>
          <button type="button" style={secondaryButtonStyle} onClick={() => importInputRef.current?.click()}>
            Import project
          </button>
          <button type="button" style={primaryButtonStyle} onClick={() => onCreateProject(TEMPLATE_SEEDS[0])}>
            New blank
          </button>
        </div>
      </header>

      <input
        ref={importInputRef}
        type="file"
        accept=".json,.templara.json,application/json"
        onChange={readImport}
        style={{ display: "none" }}
      />

      <div style={dashboardScrollStyle}>
        <section style={dashboardHeroStyle}>
          <div style={dashboardHeroCopyStyle}>
            <div style={eyebrowStyle}>Studio dashboard</div>
            <h1 style={dashboardTitleStyle}>Welcome to Templara</h1>
            <p style={dashboardLeadStyle}>
              Create structured business documents, bind them to JSON data, preview deterministic
              output, and export when the template is ready.
            </p>
            {message ? <div style={dashboardMessageStyle(message.tone)}>{message.text}</div> : null}
            <div style={dashboardHeroActionsStyle}>
              <button type="button" style={primaryButtonStyle} onClick={onOpenEditor}>
                Open current project
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => onCreateProject(TEMPLATE_SEEDS[1])}>
                Start from invoice
              </button>
            </div>
          </div>
          <div style={dashboardSummaryGridStyle}>
            <DashboardStat label="Local projects" value={String(store.projects.length)} />
            <DashboardStat label="Starter templates" value={String(TEMPLATE_SEEDS.length)} />
            <DashboardStat label="Current status" value={dirty ? "Unsaved" : "Saved"} />
          </div>
        </section>

        <section style={dashboardSectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Recent projects</h2>
              <p style={sectionDescriptionStyle}>Open a local project or continue the selected draft.</p>
            </div>
            <button type="button" style={smallSecondaryButtonStyle} onClick={() => importInputRef.current?.click()}>
              Import
            </button>
          </div>
          <div style={projectGridStyle}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                active={project.id === activeProject.id}
                dirty={project.id === activeProject.id && dirty}
                onOpen={() => onOpenProject(project.id)}
              />
            ))}
          </div>
        </section>

        <section style={dashboardSectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Create from template</h2>
              <p style={sectionDescriptionStyle}>
                Each starter becomes a separate editable local project.
              </p>
            </div>
          </div>
          <div style={templateGridStyle}>
            {TEMPLATE_SEEDS.map((seed) => (
              <TemplateCard key={seed.id} seed={seed} onCreate={() => onCreateProject(seed)} />
            ))}
          </div>
        </section>

        <section style={dashboardSectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Docs and implementation notes</h2>
              <p style={sectionDescriptionStyle}>
                Keep the authoring product close to the package and renderer documentation.
              </p>
            </div>
          </div>
          <div style={docsGridStyle}>
            {DOC_LINKS.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" style={docCardStyle}>
                <span style={docCardTitleStyle}>{link.label}</span>
                <span style={docCardDescriptionStyle}>{link.description}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={dashboardStatStyle}>
      <span style={dashboardStatLabelStyle}>{label}</span>
      <strong style={dashboardStatValueStyle}>{value}</strong>
    </div>
  );
}

function ProjectCard({
  project,
  active,
  dirty,
  onOpen,
}: {
  project: TemplaraProject;
  active: boolean;
  dirty: boolean;
  onOpen: () => void;
}) {
  const page = project.template.pages[0];
  const nodeCount = project.template.pages.reduce(
    (total, entry) =>
      total +
      entry.layers.reduce((layerTotal, layer) => layerTotal + layer.nodes.length, 0),
    0,
  );

  return (
    <button type="button" style={projectCardStyle(active)} onClick={onOpen}>
      <span style={cardToplineStyle}>
        <span>{project.sourceTemplateId}</span>
        <span style={statusBadgeStyle(dirty)}>{dirty ? "Unsaved" : active ? "Current" : "Local"}</span>
      </span>
      <strong style={projectCardTitleStyle}>{project.name}</strong>
      <span style={projectCardMetaStyle}>
        {project.template.pages.length} page{project.template.pages.length === 1 ? "" : "s"} ·{" "}
        {page ? `${page.size.width} x ${page.size.height}px` : "No page"} · {nodeCount} node
        {nodeCount === 1 ? "" : "s"}
      </span>
      <span style={projectCardFooterStyle}>Updated {formatDashboardDate(project.updatedAt)}</span>
    </button>
  );
}

function TemplateCard({ seed, onCreate }: { seed: TemplateSeed; onCreate: () => void }) {
  const page = seed.template.pages[0];
  const description = SEED_DESCRIPTIONS[seed.id] ?? "Starter document template.";

  return (
    <button type="button" style={templateCardStyle} onClick={onCreate}>
      <span style={templatePreviewStyle(seed.id)}>
        <span style={templatePreviewLineStyle} />
        <span style={templatePreviewBlockStyle} />
        <span style={templatePreviewTableStyle} />
      </span>
      <span style={templateCardBodyStyle}>
        <strong style={templateCardTitleStyle}>{seed.label}</strong>
        <span style={templateCardDescriptionStyle}>{description}</span>
        <span style={templateCardMetaStyle}>
          {page ? `${page.size.width} x ${page.size.height}px` : "Document template"}
        </span>
      </span>
    </button>
  );
}

function EditorToolbarAccessory({
  store,
  activeProject,
  dirty,
  message,
  onBackToDashboard,
  onSelectProject,
  onCreateProject,
  onSave,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
  onImport,
}: {
  store: TemplaraProjectStore;
  activeProject: TemplaraProject;
  dirty: boolean;
  message: StudioMessage;
  onBackToDashboard: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (seed: TemplateSeed) => void;
  onSave: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (contents: string) => void;
}) {
  return (
    <div style={editorAccessoryStyle}>
      <button type="button" style={toolbarBackButtonStyle} onClick={onBackToDashboard}>
        Dashboard
      </button>
      <ProjectMenu
        store={store}
        activeProject={activeProject}
        dirty={dirty}
        message={message}
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
        onSave={onSave}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onExport={onExport}
        onImport={onImport}
      />
    </div>
  );
}

function ProjectMenu({
  store,
  activeProject,
  dirty,
  message,
  onSelectProject,
  onCreateProject,
  onSave,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
  onImport,
}: {
  store: TemplaraProjectStore;
  activeProject: TemplaraProject;
  dirty: boolean;
  message: StudioMessage;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (seed: TemplateSeed) => void;
  onSave: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (contents: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const projectCount = store.projects.length;
  const activeSeed = TEMPLATE_SEEDS.find((seed) => seed.id === activeProject.sourceTemplateId);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent): void {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const readImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onImport(String(reader.result ?? ""));
      setOpen(false);
    };
    reader.readAsText(file);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" style={triggerStyle} onClick={() => setOpen((value) => !value)}>
        <span style={triggerLabelStyle}>Project</span>
        <span style={triggerNameStyle}>{activeProject.name}</span>
        <span style={triggerMetaStyle}>{dirty ? "Unsaved" : activeSeed?.label ?? "Local"}</span>
        <span style={chevronStyle} aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.templara.json,application/json"
        onChange={readImport}
        style={{ display: "none" }}
      />
      {open ? (
        <div style={menuStyle} role="menu">
          <div style={menuHeaderStyle}>
            <strong>{activeProject.name}</strong>
            <span>{dirty ? "Unsaved changes" : "Saved locally"}</span>
          </div>
          {message ? <div style={messageStyle(message.tone)}>{message.text}</div> : null}
          <MenuAction
            label="Save project"
            meta={dirty ? "Unsaved" : "Saved"}
            onClick={() => {
              onSave();
              setOpen(false);
            }}
            disabled={!dirty}
          />
          <MenuAction label="Rename" onClick={onRename} />
          <MenuAction label="Duplicate" onClick={onDuplicate} />
          <MenuAction label="Export .templara.json" onClick={onExport} />
          <MenuAction label="Import .templara.json" onClick={() => inputRef.current?.click()} />
          <MenuAction label="Delete local project" onClick={onDelete} disabled={projectCount <= 1} danger />
          <MenuDivider />
          <MenuLabel label="Open project" />
          {store.projects.map((project) => (
            <MenuAction
              key={project.id}
              label={project.name}
              meta={project.id === activeProject.id ? "Open" : "Local"}
              active={project.id === activeProject.id}
              onClick={() => {
                onSelectProject(project.id);
                setOpen(false);
              }}
            />
          ))}
          <MenuDivider />
          <MenuLabel label="New from template" />
          {TEMPLATE_SEEDS.map((seed) => (
            <MenuAction
              key={seed.id}
              label={seed.label}
              meta={seed.id === "blank" ? "Empty" : "Starter"}
              onClick={() => {
                onCreateProject(seed);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({
  label,
  meta,
  active,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  meta?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      style={optionStyle(Boolean(active), Boolean(danger), Boolean(disabled))}
      onClick={onClick}
    >
      <span>{label}</span>
      {meta ? <span style={optionMetaStyle}>{meta}</span> : active ? <span style={{ color: "#4f46e5" }}>✓</span> : null}
    </button>
  );
}

function MenuLabel({ label }: { label: string }) {
  return <div style={menuLabelStyle}>{label}</div>;
}

function MenuDivider() {
  return <div style={menuDividerStyle} />;
}

function upsertProject(projects: TemplaraProject[], project: TemplaraProject): TemplaraProject[] {
  const index = projects.findIndex((entry) => entry.id === project.id);

  if (index < 0) {
    return [...projects, project];
  }

  return projects.map((entry) => (entry.id === project.id ? project : entry));
}

function createLocalProjectId(sourceTemplateId: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return `project-${sourceTemplateId}-${suffix}`;
}

function formatDashboardDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const dashboardShellStyle: CSSProperties = {
  height: "100%",
  width: "100%",
  display: "grid",
  gridTemplateRows: "64px minmax(0, 1fr)",
  background: "#f6f8fb",
  color: "#0f172a",
};

const dashboardTopbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 clamp(12px, 2vw, 24px)",
  borderBottom: "1px solid #e5e9f0",
  background: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(12px)",
  overflow: "hidden",
};

const dashboardBrandGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
  flex: "1 1 auto",
};

const dashboardLogoStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const dashboardBrandNameStyle: CSSProperties = {
  font: "750 17px/1.1 Geist, ui-sans-serif, system-ui, sans-serif",
  color: "#111827",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const dashboardBrandMetaStyle: CSSProperties = {
  marginTop: 3,
  font: "500 12px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  color: "#64748b",
  maxWidth: 260,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const dashboardTopActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  maxWidth: "min(58vw, 420px)",
  overflowX: "auto",
  paddingBottom: 2,
  flexShrink: 0,
};

const dashboardScrollStyle: CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  padding: "34px clamp(16px, 2.5vw, 32px) 56px",
};

const dashboardHeroStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
  gap: 28,
  alignItems: "stretch",
};

const dashboardHeroCopyStyle: CSSProperties = {
  minHeight: 260,
  padding: 32,
  borderRadius: 12,
  border: "1px solid #e5e9f0",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const eyebrowStyle: CSSProperties = {
  marginBottom: 12,
  color: "#4f46e5",
  font: "750 11px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const dashboardTitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 680,
  color: "#0f172a",
  font: "760 44px/1.04 Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: 0,
};

const dashboardLeadStyle: CSSProperties = {
  maxWidth: 660,
  margin: "16px 0 0",
  color: "#475569",
  font: "450 16px/1.58 Geist, ui-sans-serif, system-ui, sans-serif",
};

const dashboardHeroActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 24,
};

const dashboardSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "repeat(3, 1fr)",
  gap: 12,
};

const dashboardStatStyle: CSSProperties = {
  display: "grid",
  alignContent: "center",
  gap: 8,
  minHeight: 78,
  padding: "18px 20px",
  borderRadius: 12,
  border: "1px solid #e5e9f0",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const dashboardStatLabelStyle: CSSProperties = {
  color: "#64748b",
  font: "650 11px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const dashboardStatValueStyle: CSSProperties = {
  color: "#111827",
  font: "760 25px/1 Geist, ui-sans-serif, system-ui, sans-serif",
};

const dashboardSectionStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "30px auto 0",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 14,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  font: "720 18px/1.2 Geist, ui-sans-serif, system-ui, sans-serif",
};

const sectionDescriptionStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  font: "450 13px/1.4 Geist, ui-sans-serif, system-ui, sans-serif",
};

const projectGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
};

const templateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
  gap: 12,
};

const docsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 12,
};

const cardToplineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: "#64748b",
  font: "650 11px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const projectCardTitleStyle: CSSProperties = {
  marginTop: 18,
  color: "#0f172a",
  font: "720 18px/1.2 Geist, ui-sans-serif, system-ui, sans-serif",
};

const projectCardMetaStyle: CSSProperties = {
  marginTop: 9,
  color: "#64748b",
  font: "450 13px/1.45 Geist, ui-sans-serif, system-ui, sans-serif",
};

const projectCardFooterStyle: CSSProperties = {
  marginTop: 22,
  color: "#94a3b8",
  font: "500 12px/1 Geist, ui-sans-serif, system-ui, sans-serif",
};

const templateCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "92px minmax(0, 1fr)",
  gap: 14,
  minHeight: 142,
  padding: 14,
  borderRadius: 12,
  border: "1px solid #e5e9f0",
  background: "#ffffff",
  color: "#0f172a",
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const templateCardBodyStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 7,
  minWidth: 0,
};

const templateCardTitleStyle: CSSProperties = {
  color: "#0f172a",
  font: "720 15px/1.25 Geist, ui-sans-serif, system-ui, sans-serif",
};

const templateCardDescriptionStyle: CSSProperties = {
  color: "#475569",
  font: "450 13px/1.45 Geist, ui-sans-serif, system-ui, sans-serif",
};

const templateCardMetaStyle: CSSProperties = {
  color: "#94a3b8",
  font: "500 12px/1.2 'Geist Mono', ui-monospace, monospace",
};

const templatePreviewLineStyle: CSSProperties = {
  display: "block",
  width: "64%",
  height: 8,
  borderRadius: 999,
  background: "#4f46e5",
};

const templatePreviewBlockStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: 28,
  borderRadius: 6,
  border: "1px solid #dbe3ee",
  background: "#f8fafc",
};

const templatePreviewTableStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: 40,
  borderRadius: 6,
  border: "1px solid #bfdbfe",
  background:
    "linear-gradient(#eff6ff 0 33%, transparent 33% 100%), repeating-linear-gradient(90deg, transparent 0 32%, #dbeafe 32% 33%)",
};

const docCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minHeight: 126,
  padding: 18,
  borderRadius: 12,
  border: "1px solid #e5e9f0",
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const docCardTitleStyle: CSSProperties = {
  font: "720 15px/1.2 Geist, ui-sans-serif, system-ui, sans-serif",
};

const docCardDescriptionStyle: CSSProperties = {
  color: "#64748b",
  font: "450 13px/1.45 Geist, ui-sans-serif, system-ui, sans-serif",
};

const primaryButtonStyle: CSSProperties = {
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid #4f46e5",
  background: "#5b5bd6",
  color: "#ffffff",
  font: "650 13px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(79, 70, 229, 0.24)",
};

const secondaryButtonStyle: CSSProperties = {
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 13px",
  borderRadius: 8,
  border: "1px solid #d7dde8",
  background: "#ffffff",
  color: "#0f172a",
  font: "650 13px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
};

const smallSecondaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  height: 32,
  padding: "0 11px",
  fontSize: 12,
};

const ghostLinkButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  textDecoration: "none",
};

const editorAccessoryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const toolbarBackButtonStyle: CSSProperties = {
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#475569",
  font: "650 12px/1 Geist, ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
};

function dashboardMessageStyle(tone: "info" | "error"): CSSProperties {
  return {
    maxWidth: 620,
    marginTop: 18,
    padding: "10px 12px",
    borderRadius: 8,
    border: tone === "error" ? "1px solid #fecaca" : "1px solid #bfdbfe",
    background: tone === "error" ? "#fef2f2" : "#eff6ff",
    color: tone === "error" ? "#991b1b" : "#1e3a8a",
    font: "550 13px/1.45 Geist, ui-sans-serif, system-ui, sans-serif",
  };
}

function projectCardStyle(active: boolean): CSSProperties {
  return {
    display: "grid",
    alignContent: "start",
    minHeight: 172,
    padding: 18,
    borderRadius: 12,
    border: active ? "1px solid #a5b4fc" : "1px solid #e5e9f0",
    background: active ? "#f8faff" : "#ffffff",
    color: "#0f172a",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: active
      ? "0 0 0 3px rgba(99, 102, 241, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)"
      : "0 1px 2px rgba(15, 23, 42, 0.04)",
  };
}

function statusBadgeStyle(dirty: boolean): CSSProperties {
  return {
    padding: "3px 7px",
    borderRadius: 999,
    background: dirty ? "#fff7ed" : "#eef2ff",
    color: dirty ? "#c2410c" : "#4f46e5",
    font: "750 10px/1 Geist, ui-sans-serif, system-ui, sans-serif",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
}

function templatePreviewStyle(seedId: string): CSSProperties {
  const accent = seedId === "blank" ? "#cbd5e1" : seedId === "shipment-bol" ? "#0891b2" : "#6366f1";

  return {
    display: "grid",
    alignContent: "start",
    gap: 9,
    height: 114,
    padding: 10,
    borderRadius: 9,
    border: "1px solid #dbe3ee",
    background: "#ffffff",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.8)",
    ["--templara-template-accent" as string]: accent,
  };
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 32,
  maxWidth: 340,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  font: "500 13px/1 'Geist', ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const triggerLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const triggerNameStyle: CSSProperties = {
  maxWidth: 150,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const triggerMetaStyle: CSSProperties = {
  padding: "2px 6px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 11,
};

const chevronStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRight: "1.5px solid #94a3b8",
  borderBottom: "1.5px solid #94a3b8",
  transform: "rotate(45deg)",
  marginTop: -3,
  marginLeft: 2,
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  width: 286,
  maxHeight: 620,
  overflowY: "auto",
  padding: 8,
  borderRadius: 10,
  border: "1px solid #e5e9f0",
  background: "#ffffff",
  boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const menuHeaderStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "8px 10px 10px",
  color: "#0f172a",
  font: "600 13px/1.2 'Geist', ui-sans-serif, system-ui, sans-serif",
};

const menuLabelStyle: CSSProperties = {
  padding: "8px 10px 4px",
  color: "#64748b",
  font: "700 10px/1 'Geist', ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const menuDividerStyle: CSSProperties = {
  height: 1,
  margin: "6px 2px",
  background: "#eef2f7",
};

const optionMetaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
};

function messageStyle(tone: "info" | "error"): CSSProperties {
  return {
    margin: "0 4px 6px",
    padding: "7px 8px",
    borderRadius: 7,
    background: tone === "error" ? "#fef2f2" : "#eff6ff",
    color: tone === "error" ? "#991b1b" : "#1e3a8a",
    font: "500 11px/1.35 'Geist', ui-sans-serif, system-ui, sans-serif",
  };
}

function optionStyle(active: boolean, danger: boolean, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 7,
    border: "none",
    background: active ? "#f1f5f9" : "transparent",
    color: disabled ? "#94a3b8" : danger ? "#b91c1c" : active ? "#0f172a" : "#334155",
    font: "500 13px/1 'Geist', ui-sans-serif, system-ui, sans-serif",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.64 : 1,
    width: "100%",
  };
}
