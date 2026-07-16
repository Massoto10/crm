import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Cadastro gerenciado</h1>
        <p>Contas de atendentes são criadas pelo administrador da sua organização.</p>
        <Link href="/login">Voltar ao login</Link>
      </section>
    </main>
  );
}
