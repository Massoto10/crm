import { IsIn } from "class-validator";

export class SetConversationStatusDto {
  @IsIn(["open", "waiting_customer", "waiting_agent"])
  status!: "open" | "waiting_customer" | "waiting_agent";
}
