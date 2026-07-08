import { IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreatePipelineStageDto {
  @IsString()
  @MaxLength(36)
  crmClientId!: string;

  @IsString()
  @MaxLength(60)
  name!: string;

  @IsHexColor()
  color!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  hint?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
