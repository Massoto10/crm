import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.departmentsService.findAll(user.crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateDepartmentDto) {
    return this.departmentsService.create(user.crmClientId, body.name, body.permissions);
  }

  @Put(":id")
  @Roles("admin")
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: UpdateDepartmentDto) {
    return this.departmentsService.update(id, body, user.crmClientId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.departmentsService.remove(id, user.crmClientId);
  }
}
