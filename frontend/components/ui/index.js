/**
 * components/ui/index.js — AxeFlow Design System
 * Componentes base reutilizáveis. Importar daqui sempre.
 */

// ── Button ────────────────────────────────────────────────────────────────────
export function  Button({
  children,
  variant = 'primary', // primary | outline | ghost | danger | success
  size = 'md',         // sm | md | lg
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  href,
  as: Tag,
  style,
  title,
  ...props
}) {
  const base = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '0.4rem',
    fontWeight:     700,
    borderRadius:   '8px',
    cursor:         disabled || loading ? 'not-allowed' : 'pointer',
    transition:     'all 0.15s',
    border:         '1px solid transparent',
    fontFamily:     'Lato, sans-serif',
    whiteSpace:     'nowrap',
    width:          fullWidth ? '100%' : undefined,
    opacity:        disabled ? 0.6 : 1,
    textDecoration: 'none',
  };

  const sizes = {
    sm: { padding: '0.3rem 0.75rem', fontSize: '0.78rem' },
    md: { padding: '0.5rem 1.25rem', fontSize: '0.88rem' },
    lg: { padding: '0.75rem 1.75rem', fontSize: '1rem' },
  };

  const variants = {
    primary: {
      background: 'var(--cor-acento)',
      color:      '#1a0a2e',
      borderColor:'var(--cor-acento)',
    },
    outline: {
      background:  'transparent',
      color:       'var(--cor-acento)',
      borderColor: 'var(--cor-acento)',
    },
    ghost: {
      background:  'transparent',
      color:       'var(--cor-texto-suave)',
      borderColor: 'transparent',
    },
    danger: {
      background:  'rgba(239,68,68,0.12)',
      color:       '#ef4444',
      borderColor: 'rgba(239,68,68,0.4)',
    },
    success: {
      background:  'rgba(16,185,129,0.12)',
      color:       '#10b981',
      borderColor: 'rgba(16,185,129,0.4)',
    },
  };

  const finalStyle = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...style,
  };

  const content = loading
    ? <><span style={{ width: '0.8rem', height: '0.8rem', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />{children}</>
    : children;

  if (href) {
    return <a href={href} style={finalStyle} title={title} {...props}>{content}</a>;
  }

  const Component = Tag || 'button';
  return (
    <Component
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      style={finalStyle}
      title={title}
      {...props}
    >
      {content}
    </Component>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_PRESETS = {
  aberta:       { bg: 'rgba(16,185,129,0.2)',   color: '#10b981' },
  fechada:      { bg: 'rgba(239,68,68,0.2)',    color: '#ef4444' },
  concluida:    { bg: 'rgba(107,33,168,0.3)',   color: '#a78bfa' },
  confirmado:   { bg: 'rgba(16,185,129,0.2)',   color: '#10b981' },
  compareceu:   { bg: 'rgba(59,130,246,0.2)',   color: '#60a5fa' },
  faltou:       { bg: 'rgba(239,68,68,0.2)',    color: '#ef4444' },
  cancelado:    { bg: 'rgba(107,114,128,0.2)',  color: '#9ca3af' },
  lista_espera: { bg: 'rgba(245,158,11,0.2)',   color: '#f59e0b' },
  pendente:     { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  publica:      { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
};

const sizes = {
  sm: {
    padding: '0.6rem',
    valueFont: '1.2rem',
    labelFont: '0.65rem'
  },
  md: {
    padding: '1rem',
    valueFont: '1.75rem',
    labelFont: '0.72rem'
  },
  lg: {
    padding: '1.5rem',
    valueFont: '2.5rem',
    labelFont: '0.85rem'
  },
}

export function Badge({ children, preset, bg, color, style, size = 'md', ...props }) {
  const p = preset ? BADGE_PRESETS[preset] : { bg, color };
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         '3px',
      padding:     sizes[size]?.padding || '0.25rem 0.65rem',
      borderRadius:'20px',
      fontSize:    sizes[size]?.labelFont || '0.72rem',
      fontWeight:  600,
      whiteSpace:  'nowrap',
      background:  p?.bg || 'rgba(212,175,55,0.15)',
      color:       p?.color || 'var(--cor-acento)',
      ...style,
    }} {...props}>
      {children}
    </span>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ ratio = 0, color, height = '6px', style }) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const defaultColor = ratio >= 0.9
    ? 'var(--cor-perigo)'
    : ratio >= 0.6
    ? 'var(--cor-aviso)'
    : 'linear-gradient(90deg, var(--cor-secundaria), var(--cor-acento))';

  return (
    <div style={{
      width:        '100%',
      height,
      background:   'rgba(255,255,255,0.1)',
      borderRadius: '4px',
      overflow:     'hidden',
      ...style,
    }}>
      <div style={{
        height:       '100%',
        width:        `${pct}%`,
        background:   color || defaultColor,
        borderRadius: '4px',
        transition:   'width 0.4s ease',
      }} />
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style, onClick, highlight, ...props }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--cor-card)',
        border:       `1px solid ${highlight ? 'var(--cor-acento)' : 'var(--cor-borda)'}`,
        borderRadius: '12px',
        overflow:     'hidden',
        cursor:       onClick ? 'pointer' : undefined,
        transition:   'border-color 0.15s, transform 0.15s',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style }) {
  return (
    <div style={{
      background:  'rgba(107,33,168,0.2)',
      borderBottom:'1px solid var(--cor-borda)',
      padding:     '0.85rem 1.25rem',
      display:     'flex',
      alignItems:  'center',
      gap:         '0.5rem',
      flexWrap:    'wrap',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function CardBody({ children, style }) {
  return (
    <div style={{ padding: '1rem 1.25rem', ...style }}>
      {children}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, color, sub, onClick, style, size = 'md' }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--cor-card)',
        border:       '1px solid var(--cor-borda)',
        borderRadius: '12px',
        padding:      sizes[size]?.padding || '1rem',
        cursor:       onClick ? 'pointer' : undefined,
        transition:   'border-color 0.15s',
        ...style,
      }}
    >
      <div style={{ fontSize: sizes[size]?.labelFont || '0.72rem', color: color || 'var(--cor-texto-suave)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'Cinzel, serif',
        fontSize:   sizes[size]?.valueFont || '1.75rem',
        color:      color || 'var(--cor-acento)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: sizes[size]?.labelFont || '0.72rem', color: 'var(--cor-texto-suave)', marginTop: '4px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--cor-texto-suave)' }}>
      {icon && <i className={`bi bi-${icon}`} style={{ fontSize: '2.5rem', marginBottom: '0.75rem', display: 'block', opacity: 0.4 }} />}
      <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>{title}</p>
      {action}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ center = false }) {
  const el = (
    <div style={{
      width:        '36px',
      height:       '36px',
      border:       '3px solid rgba(212,175,55,0.2)',
      borderTop:    '3px solid var(--cor-acento)',
      borderRadius: '50%',
      animation:    'spin 0.8s linear infinite',
    }} />
  );
  if (!center) return el;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      {el}
    </div>
  );
}

// ── FormField ───────────────────────────────────────────────────────────────
export function FormField({ label, children, hint, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0.85rem' }}>
      <label style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: 'var(--cor-texto)'
      }}>
        {label} {required && '*'}
      </label>

      {children}

      {hint && (
        <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}