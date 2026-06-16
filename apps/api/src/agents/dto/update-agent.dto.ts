import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { UserRole } from "@prisma/client";
import { IsCuid } from "../../common/validators/is-cuid";

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsCuid()
  departmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
