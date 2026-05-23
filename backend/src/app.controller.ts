import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'simulador-psicologia-backend',
      scope: 'persona-1-auth-usuarios-roles',
      timestamp: new Date().toISOString(),
    };
  }
}
