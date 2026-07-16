import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";
import { IsCuid } from "../../common/validators/is-cuid";

export class CreateScheduledMessageDto {
  @IsOptional()
  @IsCuid()
  conversationId?: string;

  @IsOptional()
  @IsCuid()
  endCustomerId?: string;

  @IsOptional()
  @IsCuid()
  agentId?: string;

  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsDateString()
  scheduledAt!: string;
}
