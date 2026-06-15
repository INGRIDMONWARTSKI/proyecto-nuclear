import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AiAssetsModule } from './ai-assets/ai-assets.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { PostgrestModule } from './postgrest/postgrest.module';
import { GruposModule } from './grupos/grupos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { RolesModule } from './roles/roles.module';
import { SimulacionModule } from './simulacion/simulacion.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(__dirname, '..', '..', '.env'),
      ],
    }),
    MailModule,
    AiAssetsModule,
    PostgrestModule,
    AuthModule,
    RolesModule,
    UsuariosModule,
    GruposModule,
    NotificacionesModule,
    SimulacionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
