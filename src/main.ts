import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

function validarVariablesDeEntorno() {
  const variablesCriticas = [
    { nombre: 'DATABASE_HOST', obligatoria: true },
    { nombre: 'DATABASE_USERNAME', obligatoria: true },
    { nombre: 'DATABASE_PASSWORD', obligatoria: true },
    { nombre: 'DATABASE_NAME', obligatoria: true },
    { nombre: 'JWT_SECRET', obligatoria: true },
    { nombre: 'USE_DEEP_LINK', obligatoria: false },
    { nombre: 'APP_SCHEME', obligatoria: false },
    { nombre: 'FRONTEND_URL', obligatoria: false },
    { nombre: 'SMTP_HOST', obligatoria: false },
    { nombre: 'SMTP_USER', obligatoria: false },
    { nombre: 'SMTP_PASS', obligatoria: false },
  ];

  console.log('\n🔍 Validando variables de entorno...');
  
  let hayErrores = false;
  
  variablesCriticas.forEach(({ nombre, obligatoria }) => {
    const valor = process.env[nombre];
    
    if (!valor) {
      if (obligatoria) {
        console.error(`❌ Variable OBLIGATORIA faltante: ${nombre}`);
        hayErrores = true;
      } else {
        console.warn(`⚠️  Variable opcional no definida: ${nombre}`);
      }
    } else {
      const esSensible = ['DATABASE_PASSWORD', 'JWT_SECRET', 'SMTP_PASS'].includes(nombre);
      const valorLog = esSensible ? '***' : valor;
      console.log(`✅ ${nombre}: ${valorLog}`);
    }
  });

  if (hayErrores) {
    console.error('\n❌ Faltan variables de entorno obligatorias. Revisa tu archivo .env\n');
    process.exit(1); // Detiene la aplicación
  }
  
  console.log('✅ Validación completada\n');
}

async function bootstrap() {
  validarVariablesDeEntorno();
  
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const allowedOrigins = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    process.env.FRONTEND_URL, 
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      if (origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/)) {
        return callback(null, true);
      }
      
      if (origin.startsWith('exp://')) {
        return callback(null, true);
      }
      
      return callback(new Error(`CORS bloqueado para origin: ${origin}`), false);
    },
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API prefix: /api/v1`);
  
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Deep Link: ${process.env.USE_DEEP_LINK === 'true' ? 'ACTIVADO (APK)' : 'DESACTIVADO (Web)'}`);
}

bootstrap();