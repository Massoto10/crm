import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import { normalizeBrazilPhone } from "../common/phone";

// Transcodifica áudio (ex: webm/opus do navegador) para ogg/opus mono 16kHz,
// o formato de nota de voz (PTT) que o WhatsApp aceita. Sem isso o Baileys do
// Evolution estoura "Connection Closed". Retorna base64 do ogg resultante.
function transcodeToOpusOgg(inputBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libopus",
      "-b:a", "24k",
      "-f", "ogg",
      "pipe:1"
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ff.stdout.on("data", (d: Buffer) => out.push(d));
    ff.stderr.on("data", (d: Buffer) => err.push(d));
    ff.on("error", (e) => reject(e));
    ff.on("close", (code) => {
      if (code === 0 && out.length) resolve(Buffer.concat(out).toString("base64"));
      else reject(new Error(`ffmpeg exit=${code}: ${Buffer.concat(err).toString().slice(-400)}`));
    });
    ff.stdin.on("error", () => { /* ignora EPIPE se o ffmpeg fechar antes */ });
    ff.stdin.write(Buffer.from(inputBase64, "base64"));
    ff.stdin.end();
  });
}

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

  async createInstance(instanceName: string, number?: string): Promise<EvoInstance> {
    const num = number ? normalizeBrazilPhone(number) : undefined;
    this.logger.log(`createInstance name=${instanceName}`);
    // Passar `number` na criação faz o Evolution devolver o pairingCode no connect.
    return this.req("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      ...(num ? { number: num } : {})
    });
  }

  async connectInstance(instanceName: string): Promise<{ base64: string } | null> {
    this.logger.log(`connectInstance name=${instanceName}`);
    const data = await this.req<{ base64?: string }>("GET", `/instance/connect/${instanceName}`);
    return data.base64 ? { base64: data.base64 } : null;
  }

  // Login por código de pareamento: passa o número no connect e o Evolution
  // devolve um código (ex: "ABCD-EFGH") pra digitar no WhatsApp do celular.
  async requestPairingCode(instanceName: string, phone: string): Promise<{ pairingCode: string | null }> {
    const number = normalizeBrazilPhone(phone);
    this.logger.log(`requestPairingCode name=${instanceName}`);
    const data = await this.req<{ pairingCode?: string; code?: string }>(
      "GET",
      `/instance/connect/${instanceName}?number=${number}`
    );
    // NUNCA cair no `code` (isso é o QR). Só o pairingCode serve pra tela "Enter code".
    return { pairingCode: data.pairingCode ?? null };
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
    this.logger.log(`sendText instance=${instanceName}`);
    const res = await this.req<{ key?: { id?: string; remoteJid?: string } }>("POST", `/message/sendText/${instanceName}`, {
      number,
      text
    });
    return { messageId: res?.key?.id ?? null, jid: res?.key?.remoteJid ?? null };
  }

  // Envia áudio (PTT/voice). `audio` aceita base64 puro ou data URI — Evolution converte.
  async sendAudio(instanceName: string, phone: string, audioBase64: string): Promise<{ messageId: string | null; jid: string | null }> {
    const number = phone.includes("@") ? phone : normalizeBrazilPhone(phone);
    // base64 puro (sem prefixo data:)
    const raw = audioBase64.includes(",") ? audioBase64.slice(audioBase64.indexOf(",") + 1) : audioBase64;
    // Converte pro formato PTT do WhatsApp (ogg/opus). Se o ffmpeg falhar, tenta o áudio original.
    let audio = raw;
    try {
      audio = await transcodeToOpusOgg(raw);
      this.logger.log(`sendAudio transcode ok bytes=${raw.length}->${audio.length}`);
    } catch (e) {
      this.logger.error(`sendAudio transcode falhou, usando original: ${String(e)}`);
    }
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
  // `fallbackMimetype` vem do payload do WhatsApp — sem ele, mídia que o Evolution
  // devolve sem mimetype era carimbada como audio/ogg e o arquivo não abria.
  async getMediaBase64(
    instanceName: string,
    messageKeyId: string,
    fallbackMimetype = "application/octet-stream"
  ): Promise<{ base64: string; mimetype: string } | null> {
    try {
      const res = await this.req<{ base64?: string; mimetype?: string }>(
        "POST",
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        { message: { key: { id: messageKeyId } }, convertToMp4: false }
      );
      if (!res?.base64) return null;
      return { base64: res.base64, mimetype: res.mimetype?.trim() || fallbackMimetype };
    } catch (err) {
      this.logger.warn(`getMediaBase64 falhou instance=${instanceName} id=${messageKeyId}: ${err}`);
      return null;
    }
  }
}
