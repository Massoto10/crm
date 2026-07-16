import { IsOptional, IsString, MaxLength } from "class-validator";

export class SendAudioDto {
  // Áudio em base64 (data URI ou base64 puro). Limite alto p/ caber clipes de voz.
  @IsString()
  @MaxLength(15_000_000)
  audioBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mimetype?: string;
}
