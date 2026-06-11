import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiAssetsModule } from './ai-assets/ai-assets.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PostgrestModule } from './postgrest/postgrest.module';
import { GruposModule } from './grupos/grupos.module';
import { RolesModule } from './roles/roles.module';
import { SimulacionModule } from './simulacion/simulacion.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AiAssetsModule,
    PostgrestModule,
    AuthModule,
    RolesModule,
    UsuariosModule,
    GruposModule,
    SimulacionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
