import type { ReactNode } from "react";
import {
  CarFront,
  CircleDot,
  CloudRain,
  Droplets,
  Github,
  Layers,
  MapPin,
  Radio,
  Server,
  ShieldAlert,
  Triangle,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  categoryLabel,
  initials,
  severityLabel,
  statusLabel,
} from "../lib/format";
import type {
  ActivitySource,
  Category,
  IncidentStatus,
  Severity,
} from "../lib/types";

export type Tone = "teal" | "amber" | "coral" | "sky" | "muted" | "neutral";

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

const severityTone: Record<Severity, Tone> = {
  critical: "coral",
  high: "amber",
  medium: "sky",
  low: "muted",
};

const statusTone: Record<IncidentStatus, Tone> = {
  triage: "amber",
  responding: "coral",
  monitoring: "sky",
  resolved: "teal",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={severityTone[severity]} dot>
      {severityLabel[severity]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {statusLabel[status]}
    </Badge>
  );
}

const categoryIcon: Record<Category, LucideIcon> = {
  power: Zap,
  water: Droplets,
  traffic: CarFront,
  weather: CloudRain,
  network: Wifi,
  safety: ShieldAlert,
  other: CircleDot,
};

export function CategoryIcon({
  category,
  size = 16,
  className = "",
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  const Icon = categoryIcon[category] ?? CircleDot;
  return (
    <span
      className={`category-icon category-${category} ${className}`}
      title={categoryLabel[category]}
    >
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
}

const sourceIcon: Record<ActivitySource, LucideIcon> = {
  github: Github,
  vercel: Triangle,
  linear: Layers,
  ops: Radio,
  field: MapPin,
  system: Server,
};

export function SourceIcon({
  source,
  size = 15,
}: {
  source: ActivitySource;
  size?: number;
}) {
  const Icon = sourceIcon[source] ?? CircleDot;
  return (
    <span className={`source-icon source-${source}`}>
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
}

export function Avatar({
  name,
  color = "#3fd8a4",
  size = 30,
  className = "",
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.34),
        color,
        borderColor: `${color}55`,
        background: `${color}12`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          <div className="panel-heading">
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={`panel-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 520,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <XIcon />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <p className="empty-title">{title}</p>
      {detail && <p className="empty-detail">{detail}</p>}
    </div>
  );
}

export function Sparkline({
  data,
  color = "#3fd8a4",
  height = 72,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const width = 320;
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const points = data.map((value, index) => [index * step, height - (value / max) * (height - 12) - 6]);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Field signal volume over the last 12 hours">
      <path d={area} fill={color} opacity="0.10" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill={color} opacity={i === points.length - 1 ? 1 : 0.35} />
      ))}
    </svg>
  );
}
