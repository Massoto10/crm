import { IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateLeadSourceDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsHexColor()
  color!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
