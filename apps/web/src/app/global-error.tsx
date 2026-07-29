'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="screen-loader" role="alert">
          <div className="brand-mark">ScaleToNext</div>
          <h1>Ocorreu um erro inesperado.</h1>
          <button onClick={reset}>Tentar novamente</button>
        </main>
      </body>
    </html>
  );
}
