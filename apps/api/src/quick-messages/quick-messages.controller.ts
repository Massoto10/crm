import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { QuickMessagesService } from "./quick-messages.service";
import { CreateQuickMessageDto } from "./dto/create-quick-message.dto";
import { UpdateQuickMessageDto } from "./dto/update-quick-message.dto";
import { Roles } from "../auth/decorators";

@Controller("quick-messages")
export class QuickMessagesController {
  constructor(private readonly quickMessagesService: QuickMessagesService) {}

  @Get()
  findAll(
    @Query("crmClientId") crmClientId: string,
    @Query("search") search?: string,
    @Query("departmentId") departmentId?: string
  ) {
    if (!crmClientId) throw new BadRequestException("crmClientId é obrigatório");
    return this.quickMessagesService.findAll(crmClientId, search, departmentId);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreateQuickMessageDto) {
    return this.quickMessagesService.create(body);
  }

  @Put(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() body: UpdateQuickMessageDto) {
    return this.quickMessagesService.update(id, body);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.quickMessagesService.remove(id);
  }
}
