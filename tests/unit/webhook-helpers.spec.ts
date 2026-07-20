import { describe, expect, it } from "vitest";
import {
  AGENT_REPLY_GRACE_MS,
  detectFileName,
  detectMediaType,
  detectMimetype,
  extractText
} from "../../apps/api/src/whatsapp/whatsapp-webhook.service";

describe("extractText — corpo da mensagem", () => {
  it("texto simples e estendido", () => {
    expect(extractText({ conversation: "oi" })).toBe("oi");
    expect(extractText({ extendedTextMessage: { text: "oi longo" } })).toBe("oi longo");
  });

  it("legenda de imagem vira o body; sem legenda, vira placeholder", () => {
    expect(extractText({ imageMessage: { caption: "olha isso" } })).toBe("olha isso");
    expect(extractText({ imageMessage: {} })).toBe("[Imagem]");
  });

  it("ignora reação e evento de protocolo", () => {
    expect(extractText({ reactionMessage: {} })).toBeNull();
    expect(extractText({ protocolMessage: {} })).toBeNull();
  });

  it("desembrulha container efêmero e view-once", () => {
    expect(extractText({ ephemeralMessage: { message: { conversation: "sumiço" } } })).toBe("sumiço");
    expect(extractText({ viewOnceMessageV2: { message: { imageMessage: { caption: "vc" } } } })).toBe("vc");
  });

  it("tipo desconhecido não vira lixo no banco", () => {
    expect(extractText({})).toBeNull();
    expect(extractText(undefined)).toBeNull();
  });
});

describe("detectMediaType", () => {
  it("classifica cada tipo", () => {
    expect(detectMediaType({ audioMessage: {} })).toBe("audio");
    expect(detectMediaType({ imageMessage: {} })).toBe("image");
    expect(detectMediaType({ videoMessage: {} })).toBe("video");
    expect(detectMediaType({ documentMessage: {} })).toBe("document");
  });

  it("texto não é mídia", () => {
    expect(detectMediaType({ conversation: "oi" })).toBeNull();
  });

  it("enxerga dentro de container efêmero", () => {
    expect(detectMediaType({ ephemeralMessage: { message: { imageMessage: {} } } })).toBe("image");
  });
});

describe("detectMimetype — a causa do arquivo que não abria", () => {
  it("usa o mimetype declarado no payload do WhatsApp", () => {
    expect(detectMimetype({ documentMessage: { mimetype: "application/pdf" } })).toBe("application/pdf");
    expect(detectMimetype({ imageMessage: { mimetype: "image/png" } })).toBe("image/png");
  });

  it("cai num default coerente com o tipo quando o payload omite", () => {
    expect(detectMimetype({ imageMessage: {} })).toBe("image/jpeg");
    expect(detectMimetype({ videoMessage: {} })).toBe("video/mp4");
    expect(detectMimetype({ audioMessage: {} })).toBe("audio/ogg");
    expect(detectMimetype({ documentMessage: {} })).toBe("application/octet-stream");
  });

  it("NUNCA devolve audio/ogg para não-áudio — era o bug que quebrava PDF e imagem", () => {
    expect(detectMimetype({ documentMessage: {} })).not.toBe("audio/ogg");
    expect(detectMimetype({ imageMessage: {} })).not.toBe("audio/ogg");
    expect(detectMimetype({ videoMessage: {} })).not.toBe("audio/ogg");
  });

  it("mimetype só com espaços é tratado como ausente", () => {
    expect(detectMimetype({ documentMessage: { mimetype: "   " } })).toBe("application/octet-stream");
  });

  it("texto não tem mimetype", () => {
    expect(detectMimetype({ conversation: "oi" })).toBeUndefined();
  });
});

describe("detectFileName", () => {
  it("prefere fileName, cai em title", () => {
    expect(detectFileName({ documentMessage: { fileName: "a.pdf", title: "b" } })).toBe("a.pdf");
    expect(detectFileName({ documentMessage: { title: "b.docx" } })).toBe("b.docx");
  });

  it("devolve undefined quando não há nome utilizável", () => {
    expect(detectFileName({ documentMessage: {} })).toBeUndefined();
    expect(detectFileName({ documentMessage: { fileName: "  " } })).toBeUndefined();
    expect(detectFileName({ imageMessage: {} })).toBeUndefined();
  });
});

describe("AGENT_REPLY_GRACE_MS", () => {
  it("é a janela de 5 minutos combinada", () => {
    expect(AGENT_REPLY_GRACE_MS).toBe(5 * 60 * 1000);
  });
});
