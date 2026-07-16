import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { QuickMessagesService } from "./quick-messages.service";
import { CreateQuickMessageDto } from "./dto/create-quick-message.dto";
import { UpdateQuickMessageDto } from "./dto/update-quick-message.dto";
import { CurrentUser, JwtPayload, Roles } from "../auth/decorators";

@Controller("quick-messages")
export class QuickMessagesController {
  constructor(private readonly quickMessagesService: QuickMessagesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query("search") search?: string, @Query("departmentId") departmentId?: string) {
    return this.quickMessagesService.findAll(user.crmClientId, search, departmentId);
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateQuickMessageDto) {
    return this.quickMessagesService.create({ ...body, crmClientId: user.crmClientId });
  }

  @Put(":id")
  @Roles("admin")
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() body: UpdateQuickMessageDto) {
    return this.quickMessagesService.update(id, body, user.crmClientId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.quickMessagesService.remove(id, user.crmClientId);
  }
}
