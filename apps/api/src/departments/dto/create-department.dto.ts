import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(36)
  crmClientId!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;
}
