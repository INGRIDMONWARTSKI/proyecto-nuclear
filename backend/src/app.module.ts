import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PostgrestModule } from './postgrest/postgrest.module';
import { RolesModule } from './roles/roles.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PostgrestModule,
    AuthModule,
    RolesModule,
    UsuariosModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
