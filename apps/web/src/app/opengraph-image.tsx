import { ImageResponse } from 'next/og';

/**
 * Imagem do card que WhatsApp, Slack e afins mostram ao receber o link do CRM.
 *
 * Precisa ser PNG/JPG: o WhatsApp ignora SVG, entao a favicon de app/icon.svg
 * nao resolve aqui. Gerada pelo ImageResponse em vez de commitar um binario —
 * assim a arte acompanha a identidade sem passar por editor de imagem.
 */
export const alt = 'ScaleToNext CRM — atendimento por WhatsApp';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 34,
          background: '#1967ff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Mesma marca da favicon e da tela de login: balao com o canto
            inferior esquerdo quase reto. */}
        <div
          style={{
            width: 168,
            height: 168,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            background: '#ffffff',
            borderRadius: '56px 56px 56px 16px',
          }}
        >
          <div style={{ width: 26, height: 26, borderRadius: 13, background: '#1967ff' }} />
          <div style={{ width: 26, height: 26, borderRadius: 13, background: '#1967ff' }} />
          <div style={{ width: 26, height: 26, borderRadius: 13, background: '#1967ff' }} />
        </div>

        <div style={{ display: 'flex', fontSize: 86, fontWeight: 800, color: '#ffffff', letterSpacing: -2 }}>
          ScaleToNext CRM
        </div>
        <div style={{ display: 'flex', fontSize: 38, color: '#d7e6ff' }}>
          Atendimento por WhatsApp
        </div>
      </div>
    ),
    size,
  );
}
