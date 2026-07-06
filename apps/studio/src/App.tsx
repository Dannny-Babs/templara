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

  const selectProject = (projectId: string): void => {
    const project = store.projects.find((entry) => entry.id === projectId);

    if (!project) {
      return;
    }

    setStore((current) => ({ ...current, selectedProjectId: projectId }));
    setActiveProject(cloneProject(project));
    setMessage(null);
  };

  const createProject = (seed: TemplateSeed): void => {
    const project = createProjectFromSeed(seed);

    setStore((current) => ({
      version: 1,
      selectedProjectId: project.id,
      projects: [...current.projects, project],
    }));
    setActiveProject(cloneProject(project));
    setMessage({ tone: "info", text: `Created ${project.name}.` });
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
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not import project.",
      });
    }
  };

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
          <ProjectMenu
            store={store}
            activeProject={activeProject}
            dirty={dirty}
            message={message}
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
