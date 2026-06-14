import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

const PLACEHOLDER_MARKERS = [
  'tu-cuenta@gmail.com',
  'tu-app-password',
  'tu-app-password-sin-espacios',
  'example.com',
  'changeme',
];

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private smtpDiagnosticsLogged = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.logSmtpDiagnostics('inicio del backend');
  }

  async sendWelcomeEmail(
    fullName: string,
    email: string,
    temporaryPassword: string,
  ): Promise<boolean> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );
    const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login`;

    const text = [
      `Hola ${fullName},`,
      '',
      'Tu cuenta en MENTORA ha sido creada.',
      '',
      `Correo: ${email}`,
      `Contraseña temporal: ${temporaryPassword}`,
      '',
      'Por seguridad, al ingresar por primera vez deberás cambiar tu contraseña.',
      '',
      `Ingresa a: ${loginUrl}`,
      '',
      'Atentamente,',
      'Equipo MENTORA',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#102a1d">
        <h2 style="color:#2f5d34">Bienvenido a MENTORA</h2>
        <p>Hola ${fullName},</p>
        <p>Tu cuenta en MENTORA ha sido creada.</p>
        <p><strong>Correo:</strong> ${email}<br/>
        <strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
        <p>Por seguridad, al ingresar por primera vez deberás cambiar tu contraseña.</p>
        <p><a href="${loginUrl}" style="color:#7cb342">Ingresar a MENTORA</a></p>
        <p>Atentamente,<br/>Equipo MENTORA</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: 'Bienvenido a MENTORA',
      text,
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    verificationCode: string,
  ): Promise<boolean> {
    const text = [
      'Recibimos una solicitud para restablecer tu contraseña.',
      '',
      'Tu código de verificación es:',
      verificationCode,
      '',
      'El código vence en 30 minutos.',
      'Si no solicitaste este cambio, puedes ignorar este mensaje.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h2 style="color:#2f5d34">Recuperación de contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña en MENTORA.</p>
        <p>Ingresa este código de verificación en la pantalla de acceso:</p>
        <p style="margin:20px 0">
          <span style="display:inline-block;padding:14px 20px;border-radius:16px;background:#ecf7e8;color:#1f4d35;font-size:28px;font-weight:800;letter-spacing:0.32em">
            ${verificationCode}
          </span>
        </p>
        <p>El código vence en 30 minutos.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject: 'Recuperación de contraseña - MENTORA',
      text,
      html,
    });
  }

  private logSmtpDiagnostics(context: string) {
    if (this.smtpDiagnosticsLogged) {
      return;
    }

    this.smtpDiagnosticsLogged = true;
    const config = this.resolveSmtpConfig();

    this.logger.log(`Diagnóstico SMTP (${context}):`);
    this.logger.log(`  SMTP configurado: ${config.isConfigured ? 'sí' : 'no'}`);
    this.logger.log(`  SMTP_HOST: ${config.host ?? '(vacío)'}`);
    this.logger.log(`  SMTP_PORT: ${config.port || '(vacío)'}`);
    this.logger.log(`  SMTP_SECURE: ${config.secure}`);
    this.logger.log(`  SMTP_USER presente: ${config.user ? 'sí' : 'no'}`);
    this.logger.log(`  SMTP_PASS presente: ${config.pass ? 'sí' : 'no'}`);
    this.logger.log(`  SMTP_FROM presente: ${config.from ? 'sí' : 'no'}`);
    this.logger.log(
      `  Archivo .env esperado: backend/.env (Nest carga desde dist/../.env)`,
    );

    if (!config.isConfigured) {
      this.logger.warn(
        'SMTP incompleto: define SMTP_HOST y SMTP_PORT en backend/.env para habilitar correo.',
      );
      return;
    }

    if (config.hasPlaceholderCredentials) {
      this.logger.warn(
        'SMTP usa valores de ejemplo en backend/.env. Reemplaza SMTP_USER y SMTP_PASS con credenciales reales (Gmail: contraseña de aplicación).',
      );
    }

    if (config.host?.includes('gmail.com') && !config.user) {
      this.logger.warn('Gmail SMTP requiere SMTP_USER y SMTP_PASS (app password).');
    }
  }

  private resolveSmtpConfig() {
    const host = this.configService.get<string>('SMTP_HOST')?.trim() || undefined;
    const portRaw = this.configService.get<string>('SMTP_PORT')?.trim();
    const port = portRaw ? Number(portRaw) : 0;
    const user = this.configService.get<string>('SMTP_USER')?.trim() || undefined;
    const rawPass =
      this.configService.get<string>('SMTP_PASS')?.trim() || undefined;
    const pass =
      host?.includes('gmail.com') && rawPass
        ? rawPass.replace(/\s+/g, '')
        : rawPass;
    const from =
      this.configService.get<string>('SMTP_FROM')?.trim() ||
      'MENTORA <no-reply@mentora.local>';
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const hasPlaceholderCredentials = this.hasPlaceholderCredentials(user, pass);

    return {
      host,
      port: Number.isFinite(port) ? port : 0,
      user,
      pass,
      from,
      secure,
      hasPlaceholderCredentials,
      isConfigured: Boolean(host && port),
    };
  }

  private hasPlaceholderCredentials(user?: string, pass?: string): boolean {
    const values = [user, pass].filter(Boolean).join(' ').toLowerCase();
    return PLACEHOLDER_MARKERS.some((marker) =>
      values.includes(marker.toLowerCase()),
    );
  }

  private async sendMail(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<boolean> {
    this.logSmtpDiagnostics('intento de envío');

    const config = this.resolveSmtpConfig();

    if (!config.isConfigured) {
      this.logger.warn(
        `Correo no enviado a ${params.to}: SMTP_HOST o SMTP_PORT no configurados.`,
      );
      return false;
    }

    if (config.hasPlaceholderCredentials) {
      this.logger.warn(
        `Correo no enviado a ${params.to}: credenciales SMTP de ejemplo en backend/.env. Configura SMTP_USER y SMTP_PASS reales.`,
      );
      return false;
    }

    if (config.host?.includes('gmail.com') && (!config.user || !config.pass)) {
      this.logger.warn(
        `Correo no enviado a ${params.to}: Gmail requiere SMTP_USER y SMTP_PASS.`,
      );
      return false;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
      });

      await transporter.sendMail({
        from: config.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      this.logger.log(`Correo enviado correctamente a ${params.to}.`);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(
        `No fue posible enviar correo a ${params.to}: ${message}`,
      );

      if (config.host?.includes('gmail.com')) {
        this.logger.warn(
          'Gmail: verifica contraseña de aplicación, SMTP_PORT=587, SMTP_SECURE=false y que SMTP_FROM use el mismo correo autorizado.',
        );
      }

      return false;
    }
  }
}
