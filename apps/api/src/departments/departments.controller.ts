import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { Roles } from "../auth/decorators";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(@Query("crmClientId") crmClientId: string) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.departmentsService.findAll(crmClientId);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreateDepartmentDto) {
    return this.departmentsService.create(body.crmClientId, body.name, body.permissions);
  }

  @Put(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() body: UpdateDepartmentDto) {
    return this.departmentsService.update(id, body);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.departmentsService.remove(id);
  }
}
