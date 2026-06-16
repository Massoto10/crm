import { Injectable, Logger } from "@nestjs/common";
import { normalizeBrazilPhone } from "../common/phone";

export interface EvoInstance {
  instanceName: string;
  status: "open" | "connecting" | "close";
  qrcode?: { base64: string };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private get baseUrl() {
    return process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
  }

  private get apiKey() {
    return process.env.EVOLUTION_API_KEY ?? "";
  }

  private headers() {
    return { "Content-Type": "application/json", apikey: this.apiKey };
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      this.logger.error(`Evolution API ${method} ${path} → ${res.status}: ${text}`);
      throw new Error(`Evolution API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async createInstance(instanceName: string): Promise<EvoInstance> {
    this.logger.log(`createInstance name=${instanceName}`);
    return this.req("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    });
  }

  async connectInstance(instanceName: string): Promise<{ base64: string } | null> {
    this.logger.log(`connectInstance name=${instanceName}`);
    const data = await this.req<{ base64?: string }>("GET", `/instance/connect/${instanceName}`);
    return data.base64 ? { base64: data.base64 } : null;
  }

  async getInstanceStatus(instanceName: string): Promise<{ state: string } | null> {
    try {
      const data = await this.req<{ instance: { state: string } }>(
        "GET",
        `/instance/connectionState/${instanceName}`
      );
      return { state: data?.instance?.state ?? "close" };
    } catch (err) {
      this.logger.warn(`getInstanceStatus falhou name=${instanceName}: ${err}`);
      return null;
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    this.logger.log(`deleteInstance name=${instanceName}`);
    await this.req("DELETE", `/instance/delete/${instanceName}`);
  }

  async sendText(instanceName: string, phone: string, text: string): Promise<{ messageId: string | null; jid: string | null }> {
    // Pass a full JID as-is; otherwise normalize to E.164-BR (prefix 55) so Evolution
    // resolves the correct JID — BR numbers without the country code are rejected.
    const number = phone.includes("@") ? phone : normalizeBrazilPhone(phone);
    this.logger.log(`sendText instance=${instanceName} to=${number}`);
    const res = await this.req<{ key?: { id?: string; remoteJid?: string } }>("POST", `/message/sendText/${instanceName}`, {
      number,
      text
    });
    return { messageId: res?.key?.id ?? null, jid: res?.key?.remoteJid ?? null };
  }

  // Envia áudio (PTT/voice). `audio` aceita base64 puro ou data URI — Evolution converte.
  async sendAudio(instanceName: string, phone: string, audioBase64: string): Promise<{ messageId: string | null; jid: string | null }> {
    const number = phone.includes("@") ? phone : normalizeBrazilPhone(phone);
    // Evolution espera base64 sem o prefixo data:
    const audio = audioBase64.includes(",") ? audioBase64.slice(audioBase64.indexOf(",") + 1) : audioBase64;
    this.logger.log(`sendAudio instance=${instanceName} to=${number} bytes=${audio.length}`);
    const res = await this.req<{ key?: { id?: string; remoteJid?: string } }>("POST", `/message/sendWhatsAppAudio/${instanceName}`, {
      number,
      audio
    });
    return { messageId: res?.key?.id ?? null, jid: res?.key?.remoteJid ?? null };
  }

  // Envia mídia (imagem/vídeo/documento). `media` aceita base64 puro ou data URI.
  async sendMedia(
    instanceName: string,
    phone: string,
    opts: { mediatype: "image" | "video" | "document"; base64: string; mimetype?: string; fileName?: string; caption?: string }
  ): Promise<{ messageId: string | null; jid: string | null }> {
    const number = phone.includes("@") ? phone : normalizeBrazilPhone(phone);
    const media = opts.base64.includes(",") ? opts.base64.slice(opts.base64.indexOf(",") + 1) : opts.base64;
    this.logger.log(`sendMedia instance=${instanceName} to=${number} type=${opts.mediatype} bytes=${media.length}`);
    const res = await this.req<{ key?: { id?: string; remoteJid?: string } }>("POST", `/message/sendMedia/${instanceName}`, {
      number,
      mediatype: opts.mediatype,
      media,
      ...(opts.mimetype ? { mimetype: opts.mimetype } : {}),
      ...(opts.fileName ? { fileName: opts.fileName } : {}),
      ...(opts.caption ? { caption: opts.caption } : {})
    });
    return { messageId: res?.key?.id ?? null, jid: res?.key?.remoteJid ?? null };
  }

  // Baixa a mídia de uma mensagem recebida (áudio/imagem/etc) como base64.
  async getMediaBase64(instanceName: string, messageKeyId: string): Promise<{ base64: string; mimetype: string } | null> {
    try {
      const res = await this.req<{ base64?: string; mimetype?: string }>(
        "POST",
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        { message: { key: { id: messageKeyId } }, convertToMp4: false }
      );
      if (!res?.base64) return null;
      return { base64: res.base64, mimetype: res.mimetype ?? "audio/ogg" };
    } catch (err) {
      this.logger.warn(`getMediaBase64 falhou instance=${instanceName} id=${messageKeyId}: ${err}`);
      return null;
    }
  }
}
