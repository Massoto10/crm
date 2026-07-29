import { createHash, timingSafeEqual } from "crypto";

/**
 * Compara dois segredos sem vazar o ponto de divergência pelo tempo de resposta.
 *
 * `a !== b` para em cima do primeiro byte diferente, então o tempo de resposta
 * cresce conforme o palpite acerta mais prefixo — dá pra reconstruir o segredo
 * byte a byte com requisições suficientes. É um ataque exigente pela rede, mas
 * o custo de fechar é praticamente zero.
 *
 * Passa pelo SHA-256 antes de comparar para que os buffers tenham sempre o mesmo
 * tamanho: `timingSafeEqual` lança se receber comprimentos diferentes, e o
 * próprio lançar já vazaria o tamanho do segredo.
 */
export function safeCompare(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
