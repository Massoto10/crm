import { IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateLeadStatusDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsHexColor()
  color!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
