import type {
  FlowNode,
  GridCellTemplate,
  GridColumn,
  GridNode,
  GridRowTemplate,
  TextNode,
} from "@templara/core";

const DEFAULT_COLUMN_WIDTH = 120;
const CELL_PADDING_X = 8;
const CELL_PADDING_Y = 8;
const DEFAULT_TEXT_HEIGHT = 14;

const headerTextStyle = {
  fontFamily: "Geist",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1.2,
  color: "#111827",
};

const bodyTextStyle = {
  fontFamily: "Geist",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.2,
  color: "#111827",
};

const footerTextStyle = {
  fontFamily: "Geist",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.2,
  color: "#111827",
};

export function addGridColumn(
  grid: GridNode,
  options: { id?: string; label?: string; width?: number } = {},
): string {
  const id = uniqueGridColumnId(grid, options.id ?? "column");
  const label = options.label?.trim() || titleCase(id);
  const width = Math.max(24, Math.round(options.width ?? DEFAULT_COLUMN_WIDTH));
  const column: GridColumn = { id, label, width };

  grid.columns.push(column);
  appendGridCell(grid, grid.row, column, "row");
  for (const [index, row] of (grid.staticRows ?? []).entries()) {
    if (!row.cells.some((cell) => cell.columnId === column.id)) {
      appendGridCell(grid, row, column, "row", String(index));
    }
  }

  if (grid.header) {
    appendGridCell(grid, grid.header, column, "header");
  }

  if (grid.footer) {
    appendGridCell(grid, grid.footer, column, "footer");
  }

  syncGridFrameWidth(grid);
  return id;
}

export function removeGridColumn(grid: GridNode, columnId: string): boolean {
  if (grid.columns.length <= 1) {
    return false;
  }

  const index = grid.columns.findIndex((column) => column.id === columnId);
  if (index < 0) {
    return false;
  }

  grid.columns.splice(index, 1);
  removeGridCell(grid.row, columnId);
  for (const row of grid.staticRows ?? []) {
    removeGridCell(row, columnId);
  }

  if (grid.header) {
    removeGridCell(grid.header, columnId);
  }

  if (grid.footer) {
    removeGridCell(grid.footer, columnId);
  }

  syncGridFrameWidth(grid);
  return true;
}

export function setGridColumnWidth(
  grid: GridNode,
  columnId: string,
  width: number,
): boolean {
  const column = grid.columns.find((entry) => entry.id === columnId);
  if (!column) {
    return false;
  }

  column.width = Math.max(24, Math.round(width));
  resizeColumnContent(grid, column);
  syncGridFrameWidth(grid);
  return true;
}

export function setGridColumnLabel(
  grid: GridNode,
  columnId: string,
  label: string,
): boolean {
  const column = grid.columns.find((entry) => entry.id === columnId);
  if (!column) {
    return false;
  }

  column.label = label.trim() || titleCase(column.id);
  syncHeaderLabel(grid, column);
  return true;
}

export function bindGridColumn(
  grid: GridNode,
  columnId: string,
  path: string,
): boolean {
  const column = grid.columns.find((entry) => entry.id === columnId);
  const rows = gridBodyRows(grid);

  if (!column) {
    return false;
  }

  const bindingPath = path.trim();
  const label = column.label ?? titleCase(column.id);

  for (const row of rows) {
    const cell = row.cells.find((entry) => entry.columnId === columnId);
    const text = cell?.content.find(
      (child): child is TextNode => child.type === "text",
    );

    if (!text) {
      continue;
    }

    text.content = bindingPath
      ? [{ kind: "field", label, binding: { path: bindingPath } }]
      : [{ kind: "text", text: "" }];
  }

  return true;
}

export function addGridStaticRow(grid: GridNode): boolean {
  if (grid.binding) {
    return false;
  }

  const rows = ensureStaticRows(grid);
  rows.push(createGridRow(grid, "row", rows.length));
  grid.row = rows[0] ?? grid.row;
  syncGridFrameHeight(grid);
  return true;
}

export function removeGridStaticRow(grid: GridNode, index: number): boolean {
  if (grid.binding) {
    return false;
  }

  const rows = ensureStaticRows(grid);

  if (rows.length <= 1 || index < 0 || index >= rows.length) {
    return false;
  }

  rows.splice(index, 1);
  grid.row = rows[0] ?? grid.row;
  syncGridFrameHeight(grid);
  return true;
}

export function setGridCellStyle(
  grid: GridNode,
  rowKind: "header" | "row" | "footer",
  columnId: string,
  patch: Partial<NonNullable<GridCellTemplate["style"]>>,
  rowIndex = 0,
): boolean {
  const cell = gridCell(grid, rowKind, columnId, rowIndex);

  if (!cell) {
    return false;
  }

  cell.style = {
    ...cell.style,
    ...patch,
  };
  return true;
}

export function setGridCellPadding(
  grid: GridNode,
  rowKind: "header" | "row" | "footer",
  columnId: string,
  padding: number,
  rowIndex = 0,
): boolean {
  const cell = gridCell(grid, rowKind, columnId, rowIndex);
  const column = grid.columns.find((entry) => entry.id === columnId);

  if (!cell || !column) {
    return false;
  }

  const nextPadding = Math.max(0, Math.round(padding));

  for (const child of cell.content) {
    child.frame.x = nextPadding;
    child.frame.y = nextPadding;
    child.frame.width = Math.max(24, column.width - nextPadding * 2);
  }

  return true;
}

export function setGridHeaderEnabled(grid: GridNode, enabled: boolean): void {
  if (enabled) {
    grid.header = ensureRowForColumns(grid, "header");
    return;
  }

  delete grid.header;
}

export function setGridFooterEnabled(grid: GridNode, enabled: boolean): void {
  if (enabled) {
    grid.footer = ensureRowForColumns(grid, "footer");
    return;
  }

  delete grid.footer;
}

export function setGridRepeatHeaderOnBreak(
  grid: GridNode,
  enabled: boolean,
): void {
  grid.behavior = {
    ...grid.behavior,
    repeatHeaderOnPageBreak: enabled ? true : undefined,
  };
  pruneEmptyGridBehavior(grid);
}

export function setGridAllowRowSplit(grid: GridNode, enabled: boolean): void {
  grid.behavior = {
    ...grid.behavior,
    allowRowSplit: enabled ? true : undefined,
  };
  pruneEmptyGridBehavior(grid);
}

export function syncGridFrameWidth(grid: GridNode): void {
  grid.frame.width = grid.columns.reduce((sum, column) => sum + column.width, 0);
}

export function syncGridFrameHeight(grid: GridNode): void {
  const headerHeight = grid.header ? gridRowHeight(grid, grid.header) : 0;
  const bodyHeight = gridBodyRows(grid).reduce(
    (sum, row) => sum + gridRowHeight(grid, row),
    0,
  );
  const footerHeight = grid.footer ? gridRowHeight(grid, grid.footer) : 0;

  grid.frame.height = Math.max(grid.frame.height, headerHeight + bodyHeight + footerHeight);
}

function appendGridCell(
  grid: GridNode,
  row: GridRowTemplate,
  column: GridColumn,
  kind: "header" | "row" | "footer",
  idSuffix?: string,
): void {
  row.cells.push(createGridCell(grid, column, kind, idSuffix));
}

function removeGridCell(row: GridRowTemplate, columnId: string): void {
  row.cells = row.cells.filter((cell) => cell.columnId !== columnId);
}

function ensureRowForColumns(
  grid: GridNode,
  kind: "header" | "footer",
): GridRowTemplate {
  const existing = kind === "header" ? grid.header : grid.footer;
  const cells = grid.columns.map((column) => {
    const current = existing?.cells.find((cell) => cell.columnId === column.id);
    return current ?? createGridCell(grid, column, kind);
  });

  return { cells };
}

function createGridRow(
  grid: GridNode,
  kind: "header" | "row" | "footer",
  rowIndex = 0,
): GridRowTemplate {
  return {
    cells: grid.columns.map((column) =>
      createGridCell(grid, column, kind, kind === "row" ? String(rowIndex) : undefined),
    ),
  };
}

function createGridCell(
  grid: GridNode,
  column: GridColumn,
  kind: "header" | "row" | "footer",
  idSuffix?: string,
): GridCellTemplate {
  return {
    columnId: column.id,
    content: [createCellText(grid, column, kind, idSuffix)],
    style:
      kind === "header"
        ? { fill: "#f8fafc", stroke: "#d8dee8", strokeWidth: 1 }
        : { fill: "#ffffff", stroke: "#d8dee8", strokeWidth: 1 },
  };
}

function createCellText(
  grid: GridNode,
  column: GridColumn,
  kind: "header" | "row" | "footer",
  idSuffix?: string,
): TextNode {
  const label = column.label ?? titleCase(column.id);
  const rowSuffix = idSuffix ? `-${idSuffix}` : "";

  return {
    id: `${grid.id}-${kind}${rowSuffix}-${column.id}-text`,
    type: "text",
    frame: {
      x: CELL_PADDING_X,
      y: CELL_PADDING_Y,
      width: Math.max(24, column.width - CELL_PADDING_X * 2),
      height: DEFAULT_TEXT_HEIGHT,
    },
    content:
      kind === "row"
        ? [{ kind: "field", label, binding: { path: `item.${column.id}` } }]
        : [{ kind: "text", text: kind === "footer" ? "" : label }],
    style:
      kind === "header"
        ? headerTextStyle
        : kind === "footer"
          ? footerTextStyle
          : bodyTextStyle,
  };
}

function resizeColumnContent(grid: GridNode, column: GridColumn): void {
  for (const row of [grid.header, ...gridBodyRows(grid), grid.footer]) {
    const cell = row?.cells.find((entry) => entry.columnId === column.id);
    if (!cell) {
      continue;
    }

    for (const child of cell.content) {
      child.frame.width = Math.max(24, column.width - child.frame.x * 2);
    }
  }
}

function syncHeaderLabel(grid: GridNode, column: GridColumn): void {
  const cell = grid.header?.cells.find((entry) => entry.columnId === column.id);
  const firstText = cell?.content.find(
    (child): child is TextNode => child.type === "text",
  );
  const firstRun = firstText?.content[0];

  if (firstRun?.kind === "text") {
    firstRun.text = column.label ?? titleCase(column.id);
  }
}

function uniqueGridColumnId(grid: GridNode, rawBase: string): string {
  const base = sanitizeColumnId(rawBase) || "column";
  const existing = new Set(grid.columns.map((column) => column.id));
  let candidate = base;
  let index = 2;

  while (existing.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function sanitizeColumnId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pruneEmptyGridBehavior(grid: GridNode): void {
  if (
    !grid.behavior?.repeatHeaderOnPageBreak &&
    !grid.behavior?.allowRowSplit
  ) {
    delete grid.behavior;
  }
}

function ensureStaticRows(grid: GridNode): GridRowTemplate[] {
  grid.staticRows = grid.staticRows?.length ? grid.staticRows : [grid.row];
  grid.row = grid.staticRows[0] ?? grid.row;
  return grid.staticRows;
}

function gridBodyRows(grid: GridNode): GridRowTemplate[] {
  return grid.binding ? [grid.row] : grid.staticRows?.length ? grid.staticRows : [grid.row];
}

function gridCell(
  grid: GridNode,
  rowKind: "header" | "row" | "footer",
  columnId: string,
  rowIndex: number,
): GridCellTemplate | undefined {
  const row =
    rowKind === "header"
      ? grid.header
      : rowKind === "footer"
        ? grid.footer
        : gridBodyRows(grid)[rowIndex];

  return row?.cells.find((cell) => cell.columnId === columnId);
}

function gridRowHeight(grid: GridNode, row: GridRowTemplate): number {
  const contentBottom = row.cells.reduce((bottom, cell) => {
    const cellBottom = cell.content.reduce(
      (max, child) => Math.max(max, child.frame.y + child.frame.height),
      0,
    );
    return Math.max(bottom, cellBottom);
  }, 0);

  return Math.max(grid.rowHeight, contentBottom);
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function gridCellContent(
  grid: GridNode,
  rowKind: "header" | "row" | "footer",
  columnId: string,
  rowIndex = 0,
): FlowNode[] | undefined {
  const row =
    rowKind === "header"
      ? grid.header
      : rowKind === "footer"
        ? grid.footer
        : gridBodyRows(grid)[rowIndex];
  return row?.cells.find((cell) => cell.columnId === columnId)?.content;
}
