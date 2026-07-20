import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Move o lead automaticamente pelo funil a partir dos sinais da conversa.
 *
 * Regra determinística, sem IA: casa palavras-chave configuráveis contra o texto
 * da mensagem, levando em conta QUEM falou — "orçamento" vindo do cliente é
 * interesse (Qualificação); vindo do operador junto de um valor, é proposta
 * enviada (Proposta).
 *
 * Só avança, nunca regride, e nunca mexe na última etapa (Fechados) — fechar é
 * decisão do operador.
 */

/** Nomes das etapas padrão. O match no banco é por nome, sem acento e sem caixa,
 *  então "Qualificacao" e "Qualificação" casam igual. */
export const ETAPA_QUALIFICACAO = "qualificacao";
export const ETAPA_PROPOSTA = "proposta";

// Sinais de que o cliente demonstrou interesse comercial.
const KW_QUALIFICACAO = [
  "quanto custa", "quanto fica", "qual o valor", "qual valor", "preco", "valor",
  "orcamento", "quanto e", "tem desconto", "forma de pagamento", "parcela",
  "interessado", "interesse", "quero contratar", "quero saber", "me passa"
];

// Sinais de que o operador enviou uma proposta.
const KW_PROPOSTA = [
  "proposta", "segue o orcamento", "segue orcamento", "segue a proposta",
  "enviei a proposta", "em anexo", "segue em anexo", "contrato", "fica em",
  "valor total", "investimento"
];

export type OrigemMensagem = "cliente" | "agente";

@Injectable()
export class PipelineStageService {
  private readonly logger = new Logger(PipelineStageService.name);

  constructor(private readonly prisma: PrismaService) {}

  private stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  private norm(s: string): string {
    return this.stripAccents(s.toLowerCase()).trim();
  }

  /** Lista configurável em Settings (CSV); vazio = usa o padrão. */
  private keywords(csv: string | undefined, padrao: string[]): string[] {
    const lista = (csv ?? "")
      .split(",")
      .map((k) => this.norm(k))
      .filter(Boolean);
    return lista.length > 0 ? lista : padrao;
  }

  private temValorMonetario(texto: string): boolean {
    return /r\$\s*\d|\d+[.,]\d{2}\b|\b\d{3,}\b/.test(this.norm(texto));
  }

  /**
   * Avalia a mensagem e avança a etapa do lead, se for o caso.
   * Best-effort: qualquer falha é logada e engolida — classificar o funil nunca
   * pode derrubar o envio ou o recebimento de mensagem.
   */
  async applyFromMessage(opts: {
    crmClientId: string;
    endCustomerId: string;
    texto: string;
    origem: OrigemMensagem;
  }): Promise<void> {
    try {
      const settings = Object.fromEntries(
        (await this.prisma.setting.findMany({ where: { crmClientId: opts.crmClientId } })).map((r) => [r.key, r.value])
      ) as Record<string, string>;

      // Desligado por padrão? Não. Só não roda se explicitamente desabilitado.
      if (settings["pipeline_auto_enabled"] === "false") return;

      const texto = this.norm(opts.texto);
      if (!texto) return;

      const casa = (lista: string[]) => lista.some((k) => texto.includes(k));

      let alvo: string | null = null;

      if (opts.origem === "agente") {
        // Proposta exige sinal forte: ou a palavra "proposta"/"contrato", ou
        // menção a orçamento/valor ACOMPANHADA de um número monetário. Sem isso,
        // um "qual valor você procura?" do operador viraria proposta.
        const kwProposta = this.keywords(settings["pipeline_proposta_keywords"], KW_PROPOSTA);
        const explicito = /\bproposta\b|\bcontrato\b/.test(texto);
        if (explicito || (casa(kwProposta) && this.temValorMonetario(opts.texto))) {
          alvo = ETAPA_PROPOSTA;
        }
      } else {
        const kwQualif = this.keywords(settings["pipeline_qualificacao_keywords"], KW_QUALIFICACAO);
        if (casa(kwQualif)) alvo = ETAPA_QUALIFICACAO;
      }

      if (!alvo) return;
      await this.moverPara(opts.crmClientId, opts.endCustomerId, alvo);
    } catch (err) {
      this.logger.error(`applyFromMessage falhou customerId=${opts.endCustomerId}: ${String(err)}`);
    }
  }

  /** Valor estimado preenchido é sinal inequívoco de proposta enviada. */
  async applyFromEstimatedValue(crmClientId: string, endCustomerId: string): Promise<void> {
    try {
      await this.moverPara(crmClientId, endCustomerId, ETAPA_PROPOSTA);
    } catch (err) {
      this.logger.error(`applyFromEstimatedValue falhou customerId=${endCustomerId}: ${String(err)}`);
    }
  }

  /**
   * Move o cliente para a etapa cujo nome casa com `nomeAlvo`, se ela estiver
   * à frente da atual. Nunca regride e nunca sai da última etapa do funil.
   */
  private async moverPara(crmClientId: string, endCustomerId: string, nomeAlvo: string): Promise<void> {
    const etapas = await this.prisma.pipelineStage.findMany({
      where: { crmClientId, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true }
    });
    if (etapas.length === 0) return;

    const alvo = etapas.find((e) => this.norm(e.name) === nomeAlvo);
    if (!alvo) {
      this.logger.warn(`etapa "${nomeAlvo}" não existe no funil de ${crmClientId} — classificação ignorada`);
      return;
    }

    const cliente = await this.prisma.endCustomer.findUnique({
      where: { id: endCustomerId },
      select: { pipelineStageId: true }
    });
    if (!cliente) return;

    const atual = cliente.pipelineStageId ? etapas.find((e) => e.id === cliente.pipelineStageId) : null;

    // Já está na última etapa (Fechados)? Não mexe — fechar é decisão humana.
    const ultima = etapas[etapas.length - 1];
    if (atual && atual.id === ultima.id) return;

    // Só avança.
    if (atual && atual.order >= alvo.order) return;

    await this.prisma.endCustomer.update({
      where: { id: endCustomerId },
      data: { pipelineStageId: alvo.id }
    });
    this.logger.log(
      `pipeline: ${atual?.name ?? "(sem etapa)"} -> ${alvo.name} customerId=${endCustomerId}`
    );
  }
}
