import { Injectable, Logger } from "@nestjs/common";

/**
 * Camada de envio do Instagram Direct — skeleton pronto pra plugar.
 *
 * Integração real exige Meta Graph API: App aprovado, conta IG business ligada a
 * uma página, IG_ACCESS_TOKEN (long-lived) e IG_BUSINESS_ID. Sem isso, o envio é
 * no-op (loga aviso) e o resto do fluxo (conversa, status, lista) já funciona —
 * basta implementar `sendText` quando as credenciais existirem.
 *
 * Endpoint a usar quando plugar:
 *   POST https://graph.facebook.com/v19.0/<IG_BUSINESS_ID>/messages
 *   body: { recipient: { id: <IGSID> }, message: { text } }
 */
@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  private get accessToken(): string {
    return process.env.IG_ACCESS_TOKEN ?? "";
  }
  private get businessId(): string {
    return process.env.IG_BUSINESS_ID ?? "";
  }

  isConfigured(): boolean {
    return !!this.accessToken && !!this.businessId;
  }

  async sendText(recipient: string, _text: string): Promise<{ messageId: string | null }> {
    if (!this.isConfigured()) {
      this.logger.warn(`Instagram não configurado — DM para ${recipient} não enviada (plugue IG_ACCESS_TOKEN/IG_BUSINESS_ID)`);
      return { messageId: null };
    }
    // TODO: chamar Graph API aqui quando as credenciais Meta estiverem disponíveis.
    this.logger.warn("Instagram sendText: integração Graph API ainda não implementada");
    return { messageId: null };
  }
}
