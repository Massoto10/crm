import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateQuickMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shortcut?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
