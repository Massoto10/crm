import { NotFoundException } from "@nestjs/common";

export function assertFound<T>(entity: T | null | undefined, name: string): asserts entity is T {
  if (entity == null) throw new NotFoundException(`${name} não encontrado(a)`);
}
