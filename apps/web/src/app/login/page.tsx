'use client';

import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail, MessageCircleMore } from 'lucide-react';
import { useCrm } from '@/context/crm-context';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEALTH_INTERVAL_MS = 30_000;

type Health = 'checking' | 'ok' | 'down';

const HEALTH_LABEL: Record<Health, string> = {
  checking: 'Verificando conexão…',
  ok: 'Plataforma operacional',
  down: 'Plataforma indisponível',
};

export default function LoginPage() {
  const { ready, session, loading, login } = useCrm();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [health, setHealth] = useState<Health>('checking');
  const [checkedAt, setCheckedAt] = useState<string>('');

  useEffect(() => {
    if (ready && session) router.replace('/dashboard');
  }, [ready, session, router]);

  // O agente que não consegue entrar precisa saber se o problema é a senha dele
  // ou a API fora do ar. Esse indicador responde isso antes de abrir chamado.
  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        await apiFetch('/health');
        if (alive) setHealth('ok');
      } catch {
        if (alive) setHealth('down');
      }
      if (alive) {
        setCheckedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }
    };

    void check();
    const timer = setInterval(check, HEALTH_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') setCapsLock(event.getModifierState('CapsLock'));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmed = email.trim();
    const errors: { email?: string; password?: string } = {};
    if (!trimmed) errors.email = 'Informe seu e-mail.';
    else if (!EMAIL_RE.test(trimmed)) errors.email = 'Informe um e-mail válido.';
    if (!password) errors.password = 'Informe sua senha.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(errors.email ? 'login-email' : 'login-password')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(trimmed, password);
      if (!result.ok) {
        setError(result.message ?? 'Não foi possível entrar. Tente novamente.');
        setPassword('');
        document.getElementById('login-password')?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || loading;

  return (
    <div className="login-screen">
      <div className="login-card">
        <section className="login-form-side">
          <div className="login-logo">
            <span>
              <MessageCircleMore size={17} />
            </span>
            <strong>ScaleToNext</strong> CRM
          </div>

          <div className="login-center">
            <div className="login-body">
              <div className="login-copy">
                <h1>Entrar</h1>
                <p>Acesso restrito a usuários provisionados pelo administrador da sua instituição.</p>
              </div>

              {error ? (
                <div className="form-error" role="alert">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              ) : null}

              <form onSubmit={submit} className="login-form" noValidate>
                <div className={`login-field${fieldErrors.email ? ' has-error' : ''}`}>
                  <div className="login-label">
                    <label htmlFor="login-email">E-mail</label>
                  </div>
                  <div className="input-with-icon">
                    <Mail size={16} />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      placeholder="nome@instituicao.com.br"
                      autoComplete="username"
                      spellCheck={false}
                      autoFocus
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'login-email-msg' : undefined}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <p className="field-msg" id="login-email-msg">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                <div className={`login-field${fieldErrors.password ? ' has-error' : ''}`}>
                  <div className="login-label">
                    <label htmlFor="login-password">Senha</label>
                  </div>
                  <div className="input-with-icon">
                    <LockKeyhole size={16} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      onKeyDown={trackCapsLock}
                      onKeyUp={trackCapsLock}
                      onBlur={() => setCapsLock(false)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'login-password-msg' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="field-msg" id="login-password-msg">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                  {capsLock && !fieldErrors.password ? (
                    <p className="field-hint">Caps Lock está ativado.</p>
                  ) : null}
                </div>

                <Button type="submit" className="login-submit" disabled={busy}>
                  {busy ? 'Verificando…' : 'Entrar'}
                </Button>
              </form>
            </div>
          </div>

          <p className="login-help">
            Perdeu o acesso? A redefinição de senha é feita pelo administrador da sua instituição.
          </p>
        </section>

        <section className="login-visual-side">
          <div className="visual-glow" />

          <div className="login-status">
            <span className="status-eyebrow">Status da plataforma</span>

            <div className={`status-headline is-${health}`} aria-live="polite">
              <span className="status-dot" />
              <strong>{HEALTH_LABEL[health]}</strong>
            </div>
            <p className="status-sub">
              {checkedAt ? `Última verificação às ${checkedAt}` : 'Consultando a API de atendimento…'}
            </p>

            <ul className="status-help">
              <li>
                <strong>Não consegue entrar?</strong>
                <p>
                  Confirme se está usando o e-mail cadastrado pelo administrador. Após 5 tentativas o acesso é
                  registrado na auditoria da conta.
                </p>
              </li>
              <li>
                <strong>Instabilidade na plataforma?</strong>
                <p>
                  Se o indicador acima estiver vermelho, o problema não é o seu acesso. Acione o suporte da sua
                  instituição.
                </p>
              </li>
            </ul>
          </div>

          <div className="visual-foot">
            <span>ScaleToNext CRM</span>
            <span>Acesso monitorado e auditado</span>
          </div>
        </section>
      </div>
    </div>
  );
}
