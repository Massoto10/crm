import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { ChannelType } from "@prisma/client";
import { IsCuid } from "../../common/validators/is-cuid";

const CUID_RE = /^[a-z][a-z0-9_-]{5,39}$/i;

export class BulkScheduledMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  crmClientId?: string; // sobrescrito pelo JWT no controller

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Matches(CUID_RE, { each: true, message: "endCustomerIds deve conter IDs válidos" })
  endCustomerIds!: string[];

  @IsEnum(ChannelType)
  channelType!: ChannelType;

  @IsOptional()
  @IsCuid()
  agentId?: string;

  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsDateString()
  scheduledAt!: string;
}
