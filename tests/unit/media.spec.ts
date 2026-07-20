import { describe, expect, it } from "vitest";
import {
  downloadName,
  matchesChatStatus,
  mediaCaption,
  type ChatStatus,
  type ConvStatus
} from "../../apps/web/app/lib/media";

describe("matchesChatStatus — agrupamento das abas da inbox", () => {
  it("aba Pendente só aceita status pending", () => {
    expect(matchesChatStatus("pending", "pending")).toBe(true);
    expect(matchesChatStatus("open", "pending")).toBe(false);
    expect(matchesChatStatus("closed", "pending")).toBe(false);
  });

  it("aba Ativo cobre os três status intermediários", () => {
    for (const s of ["open", "waiting_customer", "waiting_agent"] as ConvStatus[]) {
      expect(matchesChatStatus(s, "active")).toBe(true);
    }
    expect(matchesChatStatus("pending", "active")).toBe(false);
    expect(matchesChatStatus("closed", "active")).toBe(false);
  });

  it("aba Fechado só aceita closed", () => {
    expect(matchesChatStatus("closed", "closed")).toBe(true);
    expect(matchesChatStatus("open", "closed")).toBe(false);
  });

  it("todo status cai em exatamente uma aba — sem conversa sumida nem duplicada", () => {
    const todos: ConvStatus[] = ["pending", "open", "waiting_customer", "waiting_agent", "closed"];
    const abas: ChatStatus[] = ["pending", "active", "closed"];
    for (const s of todos) {
      const hits = abas.filter((t) => matchesChatStatus(s, t));
      expect(hits, `status ${s} caiu em ${hits.length} abas`).toHaveLength(1);
    }
  });
});

describe("mediaCaption — legenda real vs placeholder do backend", () => {
  it("devolve a legenda quando existe", () => {
    expect(mediaCaption("Olha essa foto")).toBe("Olha essa foto");
  });

  it("descarta os placeholders que o backend grava sem legenda", () => {
    for (const p of ["[Imagem]", "[Vídeo]", "[Áudio]", "[Figurinha]", "[Localização]"]) {
      expect(mediaCaption(p), `placeholder ${p} vazou como legenda`).toBeNull();
    }
  });

  it("descarta documento e contato, que carregam nome junto do prefixo", () => {
    expect(mediaCaption("[Documento] contrato.pdf")).toBeNull();
    expect(mediaCaption("[Contato] Fulano")).toBeNull();
  });

  it("trata vazio, espaços, null e undefined", () => {
    expect(mediaCaption("")).toBeNull();
    expect(mediaCaption("   ")).toBeNull();
    expect(mediaCaption(null)).toBeNull();
    expect(mediaCaption(undefined)).toBeNull();
  });

  it("trima a legenda", () => {
    expect(mediaCaption("  oi  ")).toBe("oi");
  });

  it("não confunde legenda que apenas cita colchetes", () => {
    expect(mediaCaption("[Imagem] anexa no email")).toBe("[Imagem] anexa no email");
    expect(mediaCaption("vê a [Imagem]")).toBe("vê a [Imagem]");
  });
});

describe("downloadName — extensão do anexo", () => {
  const pdf = "data:application/pdf;base64,AAAA";

  it("mantém o nome quando já tem extensão", () => {
    expect(downloadName("[Documento] contrato.pdf", pdf)).toBe("contrato.pdf");
  });

  it("adiciona extensão derivada do mimetype quando o nome não tem", () => {
    expect(downloadName("[Documento] contrato", pdf)).toBe("contrato.pdf");
  });

  it("sem nome nenhum, cai em arquivo + extensão — o bug do arquivo sem extensão", () => {
    expect(downloadName("[Documento]", pdf)).toBe("arquivo.pdf");
    expect(downloadName("", pdf)).toBe("arquivo.pdf");
    expect(downloadName(null, pdf)).toBe("arquivo.pdf");
  });

  it("cobre os mimetypes comuns de Office e imagem", () => {
    const casos: Array<[string, string]> = [
      ["data:image/jpeg;base64,x", "arquivo.jpg"],
      ["data:image/png;base64,x", "arquivo.png"],
      ["data:video/mp4;base64,x", "arquivo.mp4"],
      ["data:audio/ogg;base64,x", "arquivo.ogg"],
      ["data:text/plain;base64,x", "arquivo.txt"],
      [
        "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,x",
        "arquivo.docx"
      ]
    ];
    for (const [uri, esperado] of casos) {
      expect(downloadName("[Documento]", uri)).toBe(esperado);
    }
  });

  it("mimetype desconhecido não inventa extensão", () => {
    expect(downloadName("[Documento] coisa", "data:application/x-coisa;base64,x")).toBe("coisa");
  });

  it("é tolerante a mimetype em caixa alta", () => {
    expect(downloadName("[Documento]", "DATA:APPLICATION/PDF;base64,x")).toBe("arquivo.pdf");
  });

  it("não quebra com mediaUrl que não é data URI", () => {
    expect(downloadName("[Documento] nota", "https://x/y.pdf")).toBe("nota");
  });
});
