import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";
import { CurrentUser, JwtPayload } from "../auth/decorators";
import { EndCustomersService } from "./end-customers.service";

class PatchEndCustomerDto {
  @IsOptional() @IsNumber() @Min(0) estimatedValueCents?: number;
  @IsOptional() @IsString() assignedTo?: string | null;
  @IsOptional() @IsString() pipelineStageId?: string | null;
}

class AddLabelDto {
  @IsString() @MaxLength(40) name!: string;
  @IsOptional() @IsString() @MaxLength(9) color?: string;
}

class AddTaskDto {
  @IsString() @MaxLength(200) title!: string;
}

@Controller("end-customers")
export class EndCustomersController {
  constructor(private readonly svc: EndCustomersService) {}

  // Specific literal routes must come before the root @Get() to avoid NestJS route shadowing
  @Get("duplicates")
  findDuplicates(@CurrentUser() user: JwtPayload) {
    return this.svc.findDuplicates(user.crmClientId);
  }

  @Get()
  search(
    @CurrentUser() user: JwtPayload,
    @Query("search") search = "",
    @Query("limit") limit?: string
  ) {
    return this.svc.search(user.crmClientId, search, limit ? parseInt(limit, 10) : 15);
  }

  @Post(":primaryId/merge/:duplicateId")
  merge(
    @CurrentUser() user: JwtPayload,
    @Param("primaryId") primaryId: string,
    @Param("duplicateId") duplicateId: string
  ) {
    return this.svc.merge(primaryId, duplicateId, user.crmClientId);
  }

  @Patch(":id")
  patch(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: PatchEndCustomerDto) {
    return this.svc.patch(id, body, user.crmClientId);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.svc.remove(id, user.crmClientId);
  }

  @Post(":id/labels")
  addLabel(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: AddLabelDto) {
    return this.svc.addLabel(id, user.crmClientId, body.name, body.color ?? "#206d6f");
  }

  @Delete(":id/labels/:labelId")
  removeLabel(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Param("labelId") labelId: string) {
    return this.svc.removeLabel(id, labelId, user.crmClientId);
  }

  @Post(":id/tasks")
  addTask(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: AddTaskDto) {
    return this.svc.addTask(id, user.crmClientId, body.title, user.name ?? "Agente");
  }

  @Patch("tasks/:taskId/toggle")
  toggleTask(@CurrentUser() user: JwtPayload, @Param("taskId") taskId: string) {
    return this.svc.toggleTask(taskId, user.crmClientId);
  }

  @Delete("tasks/:taskId")
  removeTask(@CurrentUser() user: JwtPayload, @Param("taskId") taskId: string) {
    return this.svc.removeTask(taskId, user.crmClientId);
  }
}
