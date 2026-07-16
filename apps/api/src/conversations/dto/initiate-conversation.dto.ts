import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ChannelType } from "@prisma/client";
import { IsCuid } from "../../common/validators/is-cuid";

export class InitiateConversationDto {
  // Either endCustomerId (existing contact) OR phone+customerName (new contact).
  @IsOptional()
  @IsCuid()
  endCustomerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  email?: string;

  @IsEnum(ChannelType)
  channelType!: ChannelType;

  @IsOptional()
  @IsCuid()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  firstMessage?: string;
}
