'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="screen-loader" role="alert">
      <div className="brand-mark">ScaleToNext</div>
      <h1>Não foi possível carregar esta tela.</h1>
      <button className="button button-primary" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
