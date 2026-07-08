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

const DOCS_URL = import.meta.env.VITE_DOCS_URL ?? "http://localhost:3001/docs";
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
        onOpenProject={(projectId) => selectProject(projectId, { openEditor: true })}
        onCreateProject={(seed) => createProject(seed, { openEditor: true })}
        onOpenEditor={() => setScreen("editor")}
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
        brandLogo={<LogoWordmark />}
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
  onOpenProject,
  onCreateProject,
  onOpenEditor,
}: {
  store: TemplaraProjectStore;
  activeProject: TemplaraProject;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (seed: TemplateSeed) => void;
  onOpenEditor: () => void;
}) {
  const projects = store.projects.map((project) =>
    project.id === activeProject.id ? activeProject : project,
  ).slice(0, 3);

  return (
    <main style={dashboardShellStyle}>
      <header style={dashboardTopbarStyle}>
        <LogoWordmark />
        <a href={DOCS_URL} target="_blank" rel="noreferrer" style={dashboardDocsButtonStyle}>
          View Docs
        </a>
      </header>

      <div style={dashboardScrollStyle}>
        <div style={dashboardContentStyle}>
          <section style={dashboardHeroStyle}>
            <div style={dashboardHeroCopyStyle}>
              <h1 style={dashboardTitleStyle}>Welcome To Templara</h1>
              <p style={dashboardLeadStyle}>
                Create structured business documents, bind them to JSON data, preview deterministic
                output, and export when the template is ready.
              </p>
              <div style={dashboardHeroActionsStyle}>
                <button type="button" style={primaryButtonStyle} onClick={onOpenEditor}>
                  Open current project
                </button>
                <button type="button" style={secondaryButtonStyle} onClick={() => onCreateProject(TEMPLATE_SEEDS[1])}>
                  Start from Invoice
                </button>
              </div>
            </div>
          </section>

          <section style={dashboardSectionStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Recent Projects</h2>
              <p style={sectionDescriptionStyle}>Open a local project or continue the selected draft.</p>
            </div>
            <div style={projectGridStyle}>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => onOpenProject(project.id)}
                />
              ))}
            </div>
          </section>

          <section style={templateSectionStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Create from template</h2>
              <p style={sectionDescriptionStyle}>
                Each starter becomes a separate editable local project.
              </p>
            </div>
            <div style={templateGridStyle}>
              {TEMPLATE_SEEDS.map((seed) => (
                <TemplateCard key={seed.id} seed={seed} onCreate={() => onCreateProject(seed)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function LogoWordmark() {
  return (
    <div style={wordmarkFrameStyle}>
      <img src="/templara-wordmark.png" alt="Templara" style={wordmarkImageStyle} />
    </div>
  );
}

function DocumentThumbnail({ variant = "default" }: { variant?: string }) {
  const rows =
    variant === "blank"
      ? [26]
      : variant === "invoice"
        ? [26, 14, 14, 60, 60, 60, 60, 26, 14]
        : variant === "receipt"
          ? [26, 17, 60, 60, 60, 60, 45]
          : [26, 17, 60, 60, 60, 60, 60, 60, 45];

  return (
    <span style={documentThumbStyle}>
      {rows.map((width, index) => (
        <span
          key={`${variant}-${index}`}
          style={{
            ...documentThumbLineStyle,
            width,
            top: documentLineTop(index, variant),
            left: documentLineLeft(index, variant),
            borderRadius: index < 2 ? 8 : 2,
          }}
        />
      ))}
    </span>
  );
}

function documentLineTop(index: number, variant: string): number {
  if (variant === "blank") return 13;
  if (variant === "invoice") {
    return [13, 13, 82, 21, 58, 47, 29, 66, 82][index] ?? 13;
  }
  if (variant === "receipt") {
    return [13, 12, 21, 58, 29, 66, 82][index] ?? 13;
  }
  return [13, 50, 21, 58, 29, 66, 37, 74, 82][index] ?? 13;
}

function documentLineLeft(index: number, variant: string): number {
  if (variant === "invoice" && (index === 1 || index === 2)) {
    return index === 1 ? 39 : 54;
  }
  if (variant === "receipt" && index === 1) {
    return 51;
  }
  return 8;
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: TemplaraProject;
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
    <button type="button" style={projectCardStyle} onClick={onOpen}>
      <DocumentThumbnail variant={project.sourceTemplateId} />
      <span style={projectCardBodyStyle}>
        <strong style={projectCardTitleStyle}>{project.name}</strong>
        <span style={projectCardMetaStyle}>
          {project.template.pages.length} page{project.template.pages.length === 1 ? "" : "s"} ·{" "}
          {page ? `${page.size.width} x ${page.size.height}px` : "No page"} · {nodeCount} node
          {nodeCount === 1 ? "" : "s"}
        </span>
        <span style={projectCardFooterStyle}>Updated {formatDashboardDate(project.updatedAt)}</span>
      </span>
    </button>
  );
}

function TemplateCard({ seed, onCreate }: { seed: TemplateSeed; onCreate: () => void }) {
  const page = seed.template.pages[0];
  const description = SEED_DESCRIPTIONS[seed.id] ?? "Starter document template.";

  return (
    <button type="button" style={templateCardStyle} onClick={onCreate}>
      <DocumentThumbnail variant={seed.id} />
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
  gridTemplateRows: "75px minmax(0, 1fr)",
  background: "#ffffff",
  color: "#051027",
};

const dashboardTopbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  padding: "18px 34px",
  background: "#ffffff",
  overflow: "hidden",
};

const wordmarkFrameStyle: CSSProperties = {
  width: 121,
  height: 39,
  position: "relative",
  overflow: "hidden",
  flexShrink: 0,
};

const wordmarkImageStyle: CSSProperties = {
  position: "absolute",
  width: "169.73%",
  height: "400.6%",
  left: "-11.58%",
  top: "-67.48%",
  maxWidth: "none",
};

const dashboardDocsButtonStyle: CSSProperties = {
  height: 39,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid rgba(80, 11, 216, 0.85)",
  background: "#7535f3",
  color: "#ffffff",
  font: "400 13.6px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  textDecoration: "none",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const dashboardScrollStyle: CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  padding: "28px 24px 72px",
};

const dashboardContentStyle: CSSProperties = {
  width: "min(1022px, calc(100vw - 48px))",
  margin: "0 auto",
};

const dashboardHeroStyle: CSSProperties = {
  padding: "24px 0",
  borderBottom: "1px solid rgba(136, 136, 136, 0.25)",
};

const dashboardHeroCopyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 28,
};

const dashboardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#051027",
  font: "500 31px/1.16 Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.93px",
  textTransform: "capitalize",
};

const dashboardLeadStyle: CSSProperties = {
  width: "min(786px, 100%)",
  margin: "-20px 0 0",
  color: "rgba(97, 97, 97, 0.85)",
  font: "400 14px/1.25 Geist, ui-sans-serif, system-ui, sans-serif",
};

const dashboardHeroActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const dashboardSectionStyle: CSSProperties = {
  marginTop: 49,
};

const templateSectionStyle: CSSProperties = {
  marginTop: 53,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 7,
  marginBottom: 25,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#000000",
  font: "500 18.6px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.186px",
};

const sectionDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#717171",
  font: "400 14px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.14px",
};

const projectGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 318px), 1fr))",
  gap: 16,
};

const templateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 318px), 1fr))",
  gap: 16,
};

const templateCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 128,
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(205, 205, 205, 0.25)",
  background: "#f5f5f5",
  color: "#000000",
  textAlign: "left",
  cursor: "pointer",
  overflow: "hidden",
};

const projectCardStyle: CSSProperties = {
  ...templateCardStyle,
};

const projectCardBodyStyle: CSSProperties = {
  width: 211,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
};

const templateCardBodyStyle: CSSProperties = {
  ...projectCardBodyStyle,
};

const projectCardTitleStyle: CSSProperties = {
  width: "100%",
  color: "#000000",
  font: "500 18.6px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.186px",
};

const templateCardTitleStyle: CSSProperties = {
  ...projectCardTitleStyle,
};

const projectCardMetaStyle: CSSProperties = {
  width: "100%",
  color: "#717171",
  font: "400 14px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.14px",
};

const templateCardDescriptionStyle: CSSProperties = {
  width: "100%",
  color: "#717171",
  font: "400 12px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.12px",
};

const projectCardFooterStyle: CSSProperties = {
  width: "100%",
  height: 29,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  color: "#a2a2a2",
  font: "400 10px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.1px",
};

const templateCardMetaStyle: CSSProperties = {
  width: "100%",
  height: 29,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  color: "#a2a2a2",
  font: "400 11px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  letterSpacing: "-0.11px",
};

const documentThumbStyle: CSSProperties = {
  width: 77,
  height: 96,
  position: "relative",
  flexShrink: 0,
  overflow: "hidden",
  borderRadius: 8,
  border: "1px solid rgba(136, 136, 136, 0.25)",
  background: "#ffffff",
};

const documentThumbLineStyle: CSSProperties = {
  position: "absolute",
  height: 5,
  background: "#e6e6e6",
};

const primaryButtonStyle: CSSProperties = {
  height: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(82, 8, 228, 0.47)",
  background: "#7535f3",
  color: "#ffffff",
  font: "500 13.6px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
  cornerShape: "squircle",
  boxShadow:
    "inset 0 3px 5px 1px rgba(188, 155, 253, 0.58), 0 2px 4px rgba(0, 0, 0, 0.12), 0 4px 3px rgba(0, 0, 0, 0.08)",
  whiteSpace: "nowrap",
};

const secondaryButtonStyle: CSSProperties = {
  height: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  borderRadius: 10,
  cornerShape: "squircle",
  border: "1px solid #d9d9d9",
  background: "#ffffff",
  color: "#616161",
  font: "500 13.6px/16.32px Geist, ui-sans-serif, system-ui, sans-serif",
  cursor: "pointer",
  boxShadow: "inset 0 3px 5px 1px rgba(209, 209, 209, 0.25), 0 1px 4px rgba(0, 0, 0, 0.12)",
  whiteSpace: "nowrap",
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
