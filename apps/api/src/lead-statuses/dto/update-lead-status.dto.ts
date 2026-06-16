import { IsBoolean, IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateLeadStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
