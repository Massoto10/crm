import { IsCuid } from "../../common/validators/is-cuid";

export class SetDepartmentDto {
  @IsCuid()
  departmentId!: string;
}
