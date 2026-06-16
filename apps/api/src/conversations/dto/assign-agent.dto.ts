import { IsCuid } from "../../common/validators/is-cuid";

export class AssignAgentDto {
  @IsCuid()
  agentId!: string;
}
