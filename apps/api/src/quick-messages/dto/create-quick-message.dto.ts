import { IsOptional, IsString, MaxLength } from "class-validator";
import { IsCuid } from "../../common/validators/is-cuid";

export class CreateQuickMessageDto {
  @IsString()
  @MaxLength(36)
  crmClientId!: string;

  @IsString()
  @MaxLength(40)
  shortcut!: string;

  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsCuid()
  departmentId?: string;
}
