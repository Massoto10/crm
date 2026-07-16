import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { UserRole } from "@prisma/client";
import { IsCuid } from "../../common/validators/is-cuid";

export class CreateAgentDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsCuid()
  departmentId?: string;
}
