import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';

@Module({
  imports: [UsuariosModule],
  controllers: [GruposController],
  providers: [GruposService, RolesGuard],
})
export class GruposModule {}
