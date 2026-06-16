/**
 * Normaliza um número de telefone brasileiro para o formato E.164 sem o "+":
 * código do país (55) + DDD + número.
 *
 * - Remove tudo que não é dígito.
 * - Número local (10 dígitos = DDD+8, ou 11 = DDD+9) → prefixa "55".
 * - Já com 55 e 12/13 dígitos → mantém.
 * - Outros tamanhos (provável número internacional) → mantém só os dígitos.
 *
 * Evolution/WhatsApp rejeita números BR sem o código do país (exists:false),
 * então tudo que sai como WhatsApp passa por aqui.
 */
export function normalizeBrazilPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return d;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}
