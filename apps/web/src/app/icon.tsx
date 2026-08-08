import { ImageResponse } from 'next/og';

/**
 * Favicon em PNG.
 *
 * A primeira versao era um SVG e a aba continuava sem icone: o arquivo era
 * servido certo (200, image/svg+xml), mas SVG como favicon depende do
 * navegador — e o nosso nao trazia width/height, so viewBox, o que impede
 * alguns de rasterizar. PNG e aceito por todos e tira a duvida do meio.
 *
 * Desenhado para 32px: bloco solido, balao branco e tres pontos. Nada de
 * gradiente ou traco fino, que nesse tamanho viram sujeira.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1967ff',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 22,
            height: 17,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: '#ffffff',
            borderRadius: 5,
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: 2, background: '#1967ff' }} />
          <div style={{ width: 4, height: 4, borderRadius: 2, background: '#1967ff' }} />
          <div style={{ width: 4, height: 4, borderRadius: 2, background: '#1967ff' }} />
        </div>
      </div>
    ),
    size,
  );
}
