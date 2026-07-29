'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  CircleHelp,
  ContactRound,
  Gauge,
  LogOut,
  Menu,
  MessageCircleMore,
  Search,
  Settings,
  Users,
  Waypoints,
  X,
} from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Avatar, Badge } from './ui';

type NavItem = { label: string; href: string; icon: React.ElementType };

const institutionNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Gauge },
  { label: 'Atendimentos', href: '/atendimentos', icon: MessageCircleMore },
  { label: 'Contatos', href: '/contatos', icon: ContactRound },
  { label: 'Funil de vendas', href: '/funil', icon: Waypoints },
  { label: 'Agendamentos', href: '/agendamentos', icon: CalendarDays },
  { label: 'Equipe', href: '/equipe', icon: Users },
  { label: 'Auditoria', href: '/auditoria', icon: ClipboardList },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

const operatorNav: NavItem[] = institutionNav.filter((item) => !['/equipe', '/auditoria', '/configuracoes'].includes(item.href));

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, session, logout, toasts, whatsapp } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);
  useEffect(() => setMobileOpen(false), [pathname]);

  const nav = useMemo(() => session?.role === 'operator' ? operatorNav : institutionNav, [session]);

  if (!ready || !session) {
    return <div className="screen-loader"><div className="brand-mark">ScaleToNext</div><span>Carregando ambiente seguro...</span></div>;
  }

  const whatsappConnected = whatsapp?.status === 'connected' || whatsapp?.status === 'open';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><div className="logo-bubble"><MessageCircleMore size={21} /></div><div><strong>ScaleToNext</strong> CRM</div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20} /></button></div>
        <nav className="sidebar-nav">{nav.map(({ label, href, icon: Icon }) => { const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} className={active ? 'active' : ''}><Icon size={18} /><span>{label}</span></Link>; })}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-context"><span>Instituição atual</span><strong>{session.institutionName ?? 'Carregando...'}</strong></div>
          <button className="support-link" type="button"><CircleHelp size={18} /><span>Central de ajuda</span></button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left"><button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button><div className="global-search"><Search size={17} /><input placeholder="Buscar contatos, conversas, agentes..." /><kbd>⌘ K</kbd></div></div>
          <div className="topbar-actions">
            <div className="tenant-pill"><Building2 size={16} /><span>{session.institutionName ?? 'Instituição'}</span><ChevronDown size={14} /></div>
            <div className="wa-pill"><MessageCircleMore size={16} /><div><small>WhatsApp</small><strong>{whatsappConnected ? 'Conectado' : 'Desconectado'}</strong></div><span className={`status-dot ${whatsappConnected ? '' : 'offline'}`} /></div>
            <button className="notification-button" type="button" aria-label="Notificações"><Bell size={18} /></button>
            <div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen((value) => !value)}><Avatar name={session.name} size="sm" /><div><strong>{session.name}</strong><small>{session.role === 'institution_admin' ? 'Administrador' : 'Operador'}</small></div><ChevronDown size={14} /></button>{profileOpen && <div className="profile-menu"><div><strong>{session.email}</strong><Badge tone="blue">Sessão ativa</Badge></div><button onClick={() => void logout()}><LogOut size={16} /> Sair</button></div>}</div>
          </div>
        </header>
        <main className="page-container">{children}</main>
      </div>
      <div className="toast-stack">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.tone}`}>{toast.message}</div>)}</div>
    </div>
  );
}
