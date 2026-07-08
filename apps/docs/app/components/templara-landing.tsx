import React, { useState, useEffect, useRef } from "react";
import { Copy, Check, ArrowRight, Command } from "lucide-react";

const IconGithub = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const C = {
  accent: "#5B5BD6",
  accentSoft: "#EEF0FF",
  ring: "0 0 0 3px rgba(91,91,214,0.14)",
  text: "#111827",
  sub: "#4B5563",
  muted: "#9CA3AF",
  hairline: "#E5E7EB",
  faint: "#F1F3F5",
  alt: "#FAFAFA",
  codeBg: "#0F172A",
};

const FONT = "'Geist', Inter, system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, monospace";
const MAXW = 1080;
const GITHUB = "https://github.com/Dannny-Babs/templara";
const INSTALL = "npm install @templara/core";
const FAVICON = "/favicon.png";
const WORDMARK = "/templara-wordmark.png";

const LogoWordmark = ({ height = 28 }: { height?: number }) => {
  const width = Math.round((121 / 39) * height);
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src={WORDMARK}
        alt="Templara"
        style={{
          position: "absolute",
          width: "169.73%",
          height: "400.6%",
          left: "-11.58%",
          top: "-67.48%",
          maxWidth: "none",
        }}
      />
    </div>
  );
};

const LogoMark = ({ size = 28 }: { size?: number }) => (
  <img
    src={FAVICON}
    alt="Templara"
    width={size}
    height={size}
    style={{ display: "block", borderRadius: 6, flexShrink: 0 }}
  />
);

const BrandLogo = ({ compact = false }: { compact?: boolean }) => (
  <a
    href="/"
    aria-label="Templara home"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      textDecoration: "none",
      color: "inherit",
    }}
  >
    {compact ? <LogoMark size={26} /> : <LogoWordmark height={28} />}
  </a>
);

type Breakpoint = "sm" | "md" | "lg";

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return "sm";
  if (width < 900) return "md";
  return "lg";
}

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window !== "undefined" ? getBreakpoint(window.innerWidth) : "lg",
  );

  useEffect(() => {
    const update = () => setBp(getBreakpoint(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return bp;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const Reveal = ({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setSeen(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen || reduced ? "none" : "translateY(8px)",
        transition: reduced
          ? "opacity 300ms ease-out"
          : `opacity 300ms ease-out ${delay}ms, transform 300ms ease-out ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Wrap = ({
  children,
  style,
  bp = "lg",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  bp?: Breakpoint;
}) => (
  <div
    style={{
      maxWidth: MAXW,
      margin: "0 auto",
      padding: bp === "sm" ? "0 16px" : "0 24px",
      ...style,
    }}
  >
    {children}
  </div>
);

const focusRing = (focused: boolean) =>
  focused ? { borderColor: C.accent, boxShadow: C.ring } : {};

const Btn = ({
  children,
  href,
  onMouseEnter,
  onMouseLeave,
}: {
  children: React.ReactNode;
  href?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) => {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <a
      href={href || "#"}
      onMouseEnter={() => {
        setHover(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setHover(false);
        onMouseLeave?.();
      }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 18px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        textDecoration: "none",
        transition: "all 120ms ease-out",
        background: "white",
        color: C.text,
        border: `1px solid ${hover ? "#D1D5DB" : C.hairline}`,
        ...focusRing(focus),
      }}
    >
      {children}
    </a>
  );
};

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: 14,
        color: hover ? C.accent : C.sub,
        textDecoration: "none",
        transition: "color 120ms ease-out",
      }}
    >
      {children}
    </a>
  );
};

const InstallCmd = ({ fullWidth = false }: { fullWidth?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(INSTALL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: fullWidth ? "space-between" : undefined,
        gap: 12,
        height: 40,
        width: fullWidth ? "100%" : undefined,
        maxWidth: fullWidth ? "100%" : undefined,
        padding: "0 14px",
        borderRadius: 8,
        cursor: "pointer",
        background: "white",
        transition: "all 120ms ease-out",
        border: `1px solid ${hover ? "#D1D5DB" : C.hairline}`,
        fontFamily: MONO,
        fontSize: 13,
        color: C.text,
        whiteSpace: "nowrap",
        overflowX: fullWidth ? "auto" : undefined,
        ...focusRing(focus || copied),
      }}
    >
      <span style={{ color: C.muted }}>$</span>
      {INSTALL}
      {copied ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: C.accent,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <Check size={13} /> Copied
        </span>
      ) : (
        <Copy size={13} color={C.muted} />
      )}
    </button>
  );
};

const StageCard = ({
  label,
  children,
  compact = false,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) => (
  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.muted,
      }}
    >
      {label}
    </span>
    <div
      style={{
        flex: 1,
        background: "white",
        borderRadius: 12,
        border: `1px solid ${C.hairline}`,
        boxShadow: "0 1px 3px rgba(17,24,39,0.04)",
        padding: compact ? 12 : 14,
        minHeight: compact ? 160 : 190,
      }}
    >
      {children}
    </div>
  </div>
);

const BindToken = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      fontFamily: MONO,
      fontSize: 11,
      color: C.accent,
      background: C.accentSoft,
      borderRadius: 4,
      padding: "2px 6px",
    }}
  >
    {children}
  </span>
);

const BarcodeStrokes = ({ h = 26, seedOffset = 0 }: { h?: number; seedOffset?: number }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: h }}>
    {Array.from({ length: 26 }).map((_, i) => (
      <span
        key={i}
        style={{
          width: (i * 7 + seedOffset) % 3 === 0 ? 3 : 1.5,
          height: "100%",
          background: C.text,
        }}
      />
    ))}
  </div>
);

const Arrow = ({ drawn, vertical = false }: { drawn: boolean; vertical?: boolean }) =>
  vertical ? (
    <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
      <svg width="14" height="34" viewBox="0 0 14 34" aria-hidden>
        <line
          x1="7"
          y1="1"
          x2="7"
          y2="26"
          stroke={C.muted}
          strokeWidth="1.5"
          strokeDasharray="26"
          strokeDashoffset={drawn ? 0 : 26}
          style={{ transition: "stroke-dashoffset 500ms ease-out 200ms" }}
        />
        <path
          d="M2 25 L7 31 L12 25"
          fill="none"
          stroke={C.muted}
          strokeWidth="1.5"
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 250ms ease-out 600ms" }}
        />
      </svg>
    </div>
  ) : (
    <div style={{ display: "flex", alignItems: "center", padding: "0 4px", marginTop: 22 }}>
      <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden>
        <line
          x1="1"
          y1="7"
          x2="26"
          y2="7"
          stroke={C.muted}
          strokeWidth="1.5"
          strokeDasharray="26"
          strokeDashoffset={drawn ? 0 : 26}
          style={{ transition: "stroke-dashoffset 500ms ease-out 200ms" }}
        />
        <path
          d="M25 2 L31 7 L25 12"
          fill="none"
          stroke={C.muted}
          strokeWidth="1.5"
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 250ms ease-out 600ms" }}
        />
      </svg>
    </div>
  );

const Pipeline = ({ bp }: { bp: Breakpoint }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 26,
  };
  const lbl: React.CSSProperties = { fontSize: 11, color: C.muted, width: 52, flexShrink: 0 };
  const vertical = bp !== "lg";

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        gap: vertical ? 0 : 4,
        alignItems: "stretch",
      }}
    >
      <StageCard label="Template" compact={vertical}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={row}>
            <span style={lbl}>text</span>
            <BindToken>{"{{customer.name}}"}</BindToken>
          </div>
          <div style={row}>
            <span style={lbl}>barcode</span>
            <BindToken>{"{{shipment.trackingNumber}}"}</BindToken>
          </div>
          <div style={{ ...row, alignItems: "flex-start" }}>
            <span style={{ ...lbl, paddingTop: 4 }}>repeat</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  border: `1px dashed ${C.accent}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  background: C.accentSoft,
                }}
              >
                <BindToken>invoice.items</BindToken>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {["name", "qty", "total"].map((c) => (
                  <span
                    key={c}
                    style={{
                      flex: 1,
                      fontSize: 10,
                      fontFamily: MONO,
                      color: C.muted,
                      border: `1px solid ${C.faint}`,
                      borderRadius: 4,
                      padding: "3px 6px",
                      textAlign: "center",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </StageCard>
      <Arrow drawn={drawn} vertical={vertical} />
      <StageCard label="Data" compact={vertical}>
        <pre
          style={{
            margin: 0,
            fontFamily: MONO,
            fontSize: 11,
            lineHeight: 1.75,
            color: C.sub,
            overflowX: "auto",
          }}
        >
          {`{
  "customer": { "name": `}
          <span style={{ color: C.accent }}>"Acme Corp"</span>
          {` },
  "shipment": {
    "trackingNumber": `}
          <span style={{ color: C.accent }}>"1Z999AA1..."</span>
          {`
  },
  "invoice": { "items": [`}
          <span style={{ color: C.muted }}>3</span>
          {`] }
}`}
        </pre>
      </StageCard>
      <Arrow drawn={drawn} vertical={vertical} />
      <StageCard label="Output" compact={vertical}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Acme Corp</span>
          <BarcodeStrokes />
          <div
            style={{
              borderTop: `1px solid ${C.faint}`,
              paddingTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {[
              ["Widget A", "2", "$50"],
              ["Widget B", "1", "$120"],
              ["Widget C", "4", "$88"],
            ].map(([n, q, t]) => (
              <div key={n} style={{ display: "flex", fontSize: 11, color: C.sub }}>
                <span style={{ flex: 1 }}>{n}</span>
                <span style={{ width: 24, textAlign: "right" }}>{q}</span>
                <span style={{ width: 40, textAlign: "right", color: C.text }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </StageCard>
    </div>
  );
};

const cardSpan = (span: number, bp: Breakpoint) => {
  if (bp === "sm") return 1;
  if (bp === "md") return span >= 2 ? 2 : 1;
  return span;
};

const CardShell = ({
  num,
  title,
  body,
  docs,
  span = 1,
  bp,
  children,
}: {
  num: string;
  title: string;
  body: string;
  docs: string;
  span?: number;
  bp: Breakpoint;
  children: React.ReactNode;
}) => {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const cols = cardSpan(span, bp);

  return (
    <a
      href={`/docs/${docs}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        gridColumn: `span ${cols}`,
        background: "white",
        borderRadius: 14,
        border: `1px solid ${hover ? "#D1D5DB" : C.hairline}`,
        padding: bp === "sm" ? 18 : 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 120ms ease-out",
        textDecoration: "none",
        color: "inherit",
        ...focusRing(focus),
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{num}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>{children}</div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: C.sub }}>{body}</p>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11.5,
          color: hover ? C.accent : C.muted,
          transition: "color 120ms",
        }}
      >
        docs/{docs}
      </span>
    </a>
  );
};

const IdenticalOutput = () => (
  <>
    <span style={{ height: 7, width: "80%", background: C.faint, borderRadius: 4 }} />
    <span style={{ height: 7, width: "60%", background: C.faint, borderRadius: 4 }} />
    <span style={{ height: 7, width: "70%", background: C.faint, borderRadius: 4 }} />
  </>
);

const bentoColumns = (bp: Breakpoint) => {
  if (bp === "sm") return "repeat(1, minmax(0, 1fr))";
  if (bp === "md") return "repeat(2, minmax(0, 1fr))";
  return "repeat(3, minmax(0, 1fr))";
};

const Bento = ({ bp }: { bp: Breakpoint }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: bentoColumns(bp),
      gap: bp === "sm" ? 12 : 14,
    }}
  >
    <CardShell
      bp={bp}
      num="01"
      title="Design on a canvas"
      span={2}
      body="Place text, images, shapes, barcodes, QR codes, and repeat sections exactly where they need to go."
      docs="packages/editor"
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["Text", "Image", "Barcode", "Repeat"].map((n) => (
          <span
            key={n}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: C.sub,
              border: `1px solid ${C.hairline}`,
              borderRadius: 8,
              padding: "7px 14px",
              background: "white",
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </CardShell>
    <CardShell
      bp={bp}
      num="02"
      title="Bind anything to data"
      body="Connect elements to JSON paths. The renderer resolves them."
      docs="core-concepts/document-model"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          border: `1px solid ${C.hairline}`,
          borderRadius: 8,
          padding: "8px 10px",
        }}
      >
        <span style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: C.text }}>
          customer.name
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: C.accent,
            background: C.accentSoft,
            borderRadius: 5,
            padding: "3px 7px",
          }}
        >
          {"{}"}
        </span>
      </div>
    </CardShell>
    <CardShell
      bp={bp}
      num="03"
      title="Repeat from arrays"
      span={2}
      body="Design a row once and bind it to an array. The renderer expands it with real data."
      docs="core-concepts/repeats-and-pagination"
    >
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            border: `1px solid ${C.accent}`,
            background: C.accentSoft,
            borderRadius: 7,
            padding: "8px 12px",
          }}
        >
          <span style={{ flex: 2, fontFamily: MONO, fontSize: 11.5, color: C.accent }}>
            item.name
          </span>
          <span style={{ flex: 1, fontFamily: MONO, fontSize: 11.5, color: C.accent }}>
            item.quantity
          </span>
          <span
            style={{
              flex: 1,
              fontFamily: MONO,
              fontSize: 11.5,
              color: C.accent,
              textAlign: "right",
            }}
          >
            item.total
          </span>
        </div>
        {[0.7, 0.45, 0.25].map((op, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              border: `1px dashed ${C.hairline}`,
              borderRadius: 7,
              padding: "8px 12px",
              opacity: op,
            }}
          >
            <span style={{ flex: 2, height: 8, background: C.faint, borderRadius: 4 }} />
            <span style={{ flex: 1, height: 8, background: C.faint, borderRadius: 4 }} />
            <span style={{ flex: 1, height: 8, background: C.faint, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </CardShell>
    <CardShell
      bp={bp}
      num="04"
      title="Barcodes & QR from values"
      body="Barcodes and QR codes generate from bound values, not uploaded images."
      docs="packages/renderer"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <BarcodeStrokes h={30} seedOffset={2} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>
          shipment.trackingNumber
        </span>
      </div>
    </CardShell>
    <CardShell
      bp={bp}
      num="05"
      title="Render consistently"
      body="Preview and export share one pipeline. Output stays predictable."
      docs="guides/render-only"
    >
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        {["Preview", "Export"].map((l) => (
          <div
            key={l}
            style={{
              flex: 1,
              border: `1px solid ${C.hairline}`,
              borderRadius: 8,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.muted,
              }}
            >
              {l}
            </span>
            <IdenticalOutput />
          </div>
        ))}
      </div>
    </CardShell>
    <CardShell
      bp={bp}
      num="06"
      title="Package-first"
      span={2}
      body="Use the editor, renderer, preview layer, or export pipeline depending on what your product needs."
      docs="packages/core"
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          "@templara/core",
          "@templara/editor",
          "@templara/renderer",
          "@templara/react-renderer",
          "@templara/pdf",
        ].map((p) => (
          <span
            key={p}
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: C.text,
              border: `1px solid ${C.hairline}`,
              borderRadius: 7,
              padding: "6px 11px",
              background: C.alt,
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </CardShell>
  </div>
);

const CODE = {
  "template.json": `{
  "pages": [{
    "nodes": [
      { "type": "text",    "binding": "customer.name" },
      { "type": "barcode", "binding": "shipment.trackingNumber" },
      { "type": "repeat",  "source": "invoice.items" }
    ]
  }]
}`,
  "data.json": `{
  "customer": { "name": "Acme Corporation" },
  "shipment": { "trackingNumber": "1Z999AA10123456784" },
  "invoice": {
    "items": [
      { "name": "Widget A", "quantity": 2, "total": 50 },
      { "name": "Widget B", "quantity": 1, "total": 120 }
    ]
  }
}`,
  "render.ts": `import { renderDocument } from '@templara/renderer';

const document = renderDocument({
  template,
  data,
});

// same template, same data, same document. every time.`,
};

type CodeTab = keyof typeof CODE;

const CodeSection = ({ bp }: { bp: Breakpoint }) => {
  const [tab, setTab] = useState<CodeTab>("render.ts");
  const [fading, setFading] = useState(false);
  const reduced = useReducedMotion();

  const switchTab = (t: CodeTab) => {
    if (t === tab) return;
    setFading(true);
    setTimeout(() => {
      setTab(t);
      setFading(false);
    }, reduced ? 0 : 120);
  };

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${C.hairline}`,
        background: C.codeBg,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: bp === "sm" ? "8px 10px 0" : "10px 14px 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {(Object.keys(CODE) as CodeTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            style={{
              fontFamily: MONO,
              fontSize: bp === "sm" ? 11.5 : 12.5,
              padding: bp === "sm" ? "8px 10px" : "8px 14px",
              flexShrink: 0,
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${t === tab ? C.accent : "transparent"}`,
              color: t === tab ? "white" : "#64748B",
              transition: "color 120ms",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <pre
        style={{
          margin: 0,
          padding: bp === "sm" ? "16px" : "22px 24px",
          fontFamily: MONO,
          fontSize: bp === "sm" ? 12 : 13.5,
          lineHeight: 1.75,
          color: "#E2E8F0",
          overflowX: "auto",
          minHeight: bp === "sm" ? 200 : 240,
          opacity: fading ? 0 : 1,
          transition: reduced ? "none" : "opacity 120ms ease-out",
        }}
      >
        {CODE[tab]}
      </pre>
    </div>
  );
};

const LAYERS = [
  ["Editor", "Helps users design the template."],
  ["Template", "Stores the document structure as JSON."],
  ["Renderer", "Resolves the template with data."],
  ["Export", "Produces the final file."],
] as const;

const Architecture = ({ bp }: { bp: Breakpoint }) => (
  <div style={{ position: "relative", paddingLeft: bp === "sm" ? 24 : 28 }}>
    <span
      style={{
        position: "absolute",
        left: 8,
        top: 14,
        bottom: 14,
        width: 1,
        background: C.hairline,
      }}
    />
    {LAYERS.map(([name, desc], i) => (
      <Reveal key={name} delay={i * 60}>
        <div
          style={{
            position: "relative",
            padding: "14px 0",
            display: "flex",
            flexDirection: bp === "sm" ? "column" : "row",
            alignItems: bp === "sm" ? "flex-start" : "baseline",
            gap: bp === "sm" ? 4 : 16,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: bp === "sm" ? -20.5 : -24.5,
              top: bp === "sm" ? 18 : 21,
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "white",
              border: `2px solid ${C.accent}`,
            }}
          />
          <span
            style={{
              fontSize: bp === "sm" ? 16 : 17,
              fontWeight: 600,
              color: C.text,
              width: bp === "sm" ? undefined : 110,
              flexShrink: 0,
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: bp === "sm" ? 14 : 15, color: C.sub }}>{desc}</span>
        </div>
      </Reveal>
    ))}
  </div>
);

const sectionPad = (bp: Breakpoint, large = true) =>
  bp === "sm" ? (large ? "64px 0 56px" : "56px 0") : large ? "96px 0 88px" : "88px 0";

export default function TemplaraLanding() {
  const bp = useBreakpoint();
  const isSm = bp === "sm";

  return (
    <div style={{ fontFamily: FONT, background: "#FFFFFF", color: C.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; font-style: normal; overflow-x: hidden; }
      `}</style>

      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.hairline}`,
        }}
      >
        <Wrap
          bp={bp}
          style={{
            display: "flex",
            alignItems: "center",
            height: isSm ? 52 : 60,
            gap: isSm ? 14 : 28,
          }}
        >
          <BrandLogo compact={isSm} />
          <span style={{ flex: 1 }} />
          <NavLink href="/docs">Docs</NavLink>
          {!isSm && <NavLink href="#architecture">Architecture</NavLink>}
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: C.sub,
              textDecoration: "none",
            }}
          >
            <IconGithub /> {!isSm && "GitHub"}
          </a>
          {!isSm && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: C.muted,
                border: `1px solid ${C.hairline}`,
                borderRadius: 7,
                padding: "5px 10px",
              }}
            >
              <Command size={12} /> K
            </span>
          )}
        </Wrap>
      </nav>

      <section style={{ padding: sectionPad(bp) }}>
        <Wrap bp={bp}>
          <Reveal>
            <h1
              style={{
                margin: 0,
                fontSize: isSm ? 36 : bp === "md" ? 44 : 56,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.08,
                maxWidth: 700,
              }}
            >
              Build documents from data, visually.
            </h1>
          </Reveal>
          <Reveal delay={60}>
            <p
              style={{
                margin: "20px 0 0",
                fontSize: isSm ? 15 : 17,
                lineHeight: 1.6,
                color: C.sub,
                maxWidth: 560,
              }}
            >
              Design templates on a canvas. Bind elements to JSON. Render consistent PDFs, PNGs,
              and browser previews.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 12,
                marginTop: 32,
                flexWrap: "wrap",
              }}
            >
              <InstallCmd fullWidth={isSm} />
              <Btn href="/docs/getting-started/quick-start">
                Start building <ArrowRight size={14} />
              </Btn>
              <Btn href="#architecture">View architecture</Btn>
            </div>
          </Reveal>
          <Reveal delay={200} style={{ marginTop: isSm ? 40 : 64 }}>
            <Pipeline bp={bp} />
          </Reveal>
        </Wrap>
      </section>

      <section
        style={{
          borderTop: `1px solid ${C.hairline}`,
          borderBottom: `1px solid ${C.hairline}`,
          background: C.alt,
        }}
      >
        <Wrap
          bp={bp}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: isSm ? 8 : 12,
            padding: isSm ? "14px 16px" : "18px 24px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13.5, color: C.muted }}>5 packages</span>
          <span style={{ color: C.hairline }}>·</span>
          <span style={{ fontSize: 13.5, color: C.muted }}>TypeScript-first</span>
          <span style={{ color: C.hairline }}>·</span>
          <span style={{ fontSize: 13.5, color: C.muted }}>One rendering pipeline</span>
        </Wrap>
      </section>

      <section style={{ padding: isSm ? "64px 0" : "104px 0" }}>
        <Wrap bp={bp}>
          <Reveal>
            <h2
              style={{
                margin: 0,
                fontSize: isSm ? 24 : 28,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Visual editing without losing structure.
            </h2>
            <p
              style={{
                margin: isSm ? "10px 0 28px" : "12px 0 40px",
                fontSize: isSm ? 15 : 16,
                color: C.sub,
                maxWidth: 560,
              }}
            >
              Templara is a browser-first document builder and rendering engine for data-driven
              documents — invoices, receipts, BOLs, labels, work orders, certificates, and reports.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Bento bp={bp} />
          </Reveal>
        </Wrap>
      </section>

      <section style={{ padding: isSm ? "0 0 64px" : "0 0 104px" }}>
        <Wrap bp={bp}>
          <Reveal>
            <CodeSection bp={bp} />
            <p style={{ margin: "16px 0 0", fontSize: 15, color: C.sub, textAlign: "center" }}>
              The same template can render one document or ten thousand.
            </p>
          </Reveal>
        </Wrap>
      </section>

      <section
        id="architecture"
        style={{
          padding: isSm ? "64px 0" : "104px 0",
          background: C.alt,
          borderTop: `1px solid ${C.hairline}`,
          borderBottom: `1px solid ${C.hairline}`,
        }}
      >
        <Wrap bp={bp} style={{ display: "flex", gap: isSm ? 32 : 64, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <Reveal>
              <h2
                style={{
                  margin: 0,
                  fontSize: isSm ? 24 : 28,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                The editor is not the renderer.
              </h2>
              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: isSm ? 15 : 15.5,
                  lineHeight: 1.65,
                  color: C.sub,
                }}
              >
                Same template, same data, same document. Every time.
              </p>
            </Reveal>
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <Architecture bp={bp} />
          </div>
        </Wrap>
      </section>

      <section style={{ padding: sectionPad(bp, false) }}>
        <Wrap bp={bp}>
          <Reveal>
            <h2
              style={{
                margin: "0 0 28px",
                fontSize: isSm ? 20 : 22,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Built for documents that repeat.
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                "Invoices",
                "Receipts",
                "Bills of lading",
                "Work orders",
                "Shipping labels",
                "Inspection reports",
                "Certificates",
                "Contracts",
                "Statements",
                "Operational reports",
              ].map((u) => (
                <span
                  key={u}
                  style={{
                    fontFamily: MONO,
                    fontSize: 12.5,
                    color: C.sub,
                    border: `1px solid ${C.hairline}`,
                    borderRadius: 999,
                    padding: "7px 14px",
                  }}
                >
                  {u}
                </span>
              ))}
            </div>
          </Reveal>
        </Wrap>
      </section>

      <section
        style={{
          padding: isSm ? "64px 0 72px" : "96px 0 104px",
          borderTop: `1px solid ${C.hairline}`,
          textAlign: "center",
        }}
      >
        <Wrap bp={bp}>
          <Reveal>
            <h2
              style={{
                margin: 0,
                fontSize: isSm ? 28 : 36,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                padding: isSm ? "0 8px" : 0,
              }}
            >
              Stop hardcoding document layouts.
            </h2>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "stretch",
                gap: 12,
                marginTop: 32,
                flexWrap: "wrap",
              }}
            >
              <InstallCmd fullWidth={isSm} />
              <Btn href="/docs/getting-started/quick-start">
                Start building <ArrowRight size={14} />
              </Btn>
              <Btn href="#architecture">View architecture</Btn>
            </div>
          </Reveal>
        </Wrap>
      </section>

      <footer style={{ borderTop: `1px solid ${C.hairline}` }}>
        <Wrap
          bp={bp}
          style={{
            display: "flex",
            alignItems: "center",
            gap: isSm ? 16 : 24,
            padding: isSm ? "20px 16px" : "26px 24px",
          }}
        >
          <LogoMark size={20} />
          <span style={{ fontSize: 13, color: C.muted }}>© Templara</span>
          <span style={{ flex: 1 }} />
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}
          >
            GitHub
          </a>
          <a href="/docs" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>
            Docs
          </a>
        </Wrap>
      </footer>
    </div>
  );
}
