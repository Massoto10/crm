import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMessageDto {
  @IsString()
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  senderName?: string;
}
