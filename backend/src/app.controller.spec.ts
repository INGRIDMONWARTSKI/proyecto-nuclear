import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns a healthy status payload', () => {
    const controller = new AppController();
    const response = controller.health();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('simulador-psicologia-backend');
    expect(response.scope).toBe('persona-1-auth-usuarios-roles');
    expect(response.timestamp).toEqual(expect.any(String));
  });
});
