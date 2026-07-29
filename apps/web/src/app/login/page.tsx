'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Mail, MessageCircleMore, ShieldCheck, Sparkles, Users, Waypoints } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const { ready, session, loading, login } = useCrm();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && session) router.replace('/dashboard');
  }, [ready, session, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const result = await login(email, password);
    if (!result.ok) setError(result.message ?? 'Não foi possível entrar.');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <section className="login-form-side">
          <div className="login-logo"><span><MessageCircleMore size={23} /></span><strong>ScaleToNext</strong> CRM</div>
          <div className="login-copy">
            <span className="eyebrow"><ShieldCheck size={14} /> Acesso restrito</span>
            <h1>Bem-vindo de volta!</h1>
            <p>Use o acesso criado pelo administrador responsável pela sua conta.</p>
          </div>

          <form onSubmit={submit} className="login-form">
            <label>
              <span>E-mail</span>
              <div className="input-with-icon"><Mail size={17} /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="seu@email.com" autoComplete="email" required /></div>
            </label>
            <label>
              <span>Senha</span>
              <div className="input-with-icon"><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>
            <div className="login-options"><label className="checkbox-line"><input type="checkbox" /> <span>Lembrar de mim</span></label><button type="button">Esqueci minha senha</button></div>
            {error ? <div className="form-error">{error}</div> : null}
            <Button type="submit" className="login-submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
          </form>

          <small className="login-note">Não existe cadastro público. Todos os acessos são criados por administradores autorizados.</small>
        </section>

        <section className="login-visual-side">
          <div className="visual-glow" />
          <div className="login-visual-copy">
            <span><Sparkles size={16} /> Operação centralizada</span>
            <h2>Centralize seu atendimento via WhatsApp</h2>
            <p>Organize conversas, equipe, contatos e vendas em um único ambiente.</p>
          </div>
          <div className="visual-stack" aria-hidden="true">
            <div className="visual-main-card">
              <div className="visual-card-head"><span className="visual-avatar">S</span><div><strong>Atendimento organizado</strong><small>Dados da sua operação</small></div><span className="online-dot" /></div>
              <div className="visual-message incoming">Centralize suas conversas.</div>
              <div className="visual-message outgoing">Tudo integrado ao seu CRM.</div>
            </div>
            <div className="floating-icon floating-users"><Users size={26} /></div>
            <div className="floating-icon floating-funnel"><Waypoints size={26} /></div>
            <div className="floating-whatsapp"><MessageCircleMore size={31} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}
