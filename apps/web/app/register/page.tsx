"use client";

import { FormEvent, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

type Org = { id: string; tradeName: string };

export default function RegisterPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [crmClientId, setCrmClientId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/api/crm-clients`)
      .then((r) => r.json())
      .then((data: Org[]) => {
        setOrgs(data);
        if (data[0]) setCrmClientId(data[0].id);
      })
      .catch(() => null);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Senhas não conferem"); return; }
    if (password.length < 6) { setError("Senha deve ter ao menos 6 caracteres"); return; }
    if (!crmClientId) { setError("Selecione uma organização"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, crmClientId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Erro ${res.status}`);
      }
      const { token } = await res.json() as { token: string };
      localStorage.setItem("stn_crm_token", token);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>STN CRM</strong>
            <span>Atendimento</span>
          </div>
        </div>

        <h1>Criar conta</h1>
        <p className="auth-sub">O primeiro usuário de cada organização vira admin automaticamente</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            Nome completo
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </label>
          <label>
            Organização
            <select value={crmClientId} onChange={(e) => setCrmClientId(e.target.value)} required>
              <option value="">Selecione...</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.tradeName}</option>)}
            </select>
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mín. 6 caracteres"
            />
          </label>
          <label>
            Confirmar senha
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="repita a senha"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Cadastrando..." : "Criar conta"}
          </button>
        </form>

        <p className="auth-footer">
          Já tem conta?{" "}
          <a href="/login">Entrar</a>
        </p>
      </div>
    </div>
  );
}
