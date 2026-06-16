import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class SendMediaDto {
  // Arquivo em base64 (data URI ou base64 puro). Limite alto p/ caber imagens/docs.
  @IsString()
  @MaxLength(15_000_000)
  base64!: string;

  @IsString()
  @MaxLength(120)
  mimetype!: string;

  @IsEnum(["image", "video", "document"] as const)
  mediatype!: "image" | "video" | "document";

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  senderName?: string;
}
