import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="screen-loader">
      <div className="brand-mark">ScaleToNext</div>
      <h1>Página não encontrada.</h1>
      <Link className="button button-primary" href="/login">Ir para o login</Link>
    </main>
  );
}
