import type { Algorithm } from "jsonwebtoken";

/**
 * Opções compartilhadas entre a emissão (auth.service) e a verificação (jwt.guard).
 * Precisam casar — divergência aqui invalida todas as sessões.
 */

// Fixar o algoritmo é o que impede confusão de algoritmo: sem esta lista, um
// token forjado com "alg":"none" ou com um algoritmo diferente do esperado entra
// na verificação e o segredo passa a ser interpretado fora do contexto de HMAC.
export const JWT_ALGORITHM: Algorithm = "HS256";
export const JWT_ALGORITHMS: Algorithm[] = [JWT_ALGORITHM];

// Amarram o token a esta aplicação: um token válido emitido por outro serviço
// que por acaso use o mesmo segredo não é aceito aqui.
export const JWT_ISSUER = "stn-crm";
export const JWT_AUDIENCE = "stn-crm-api";

export const JWT_EXPIRES_IN = "15m";

// Tolerância de relógio entre quem emite e quem verifica. Sem isto, alguns
// segundos de defasagem no servidor rejeitam token recém-emitido.
export const JWT_CLOCK_TOLERANCE_S = 10;

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  if (secret.length < 32) {
    throw new Error("JWT_SECRET curto demais: use pelo menos 32 caracteres aleatórios");
  }
  return secret;
}
