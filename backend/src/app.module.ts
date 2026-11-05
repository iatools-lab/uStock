import { loadTelemetryConfig } from './telemetry.config.js';
import { DirectorController } from './director.controller.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

const telemetryConfig=loadTelemetryConfig();
const observe=telemetryConfig ? createObserveModule() : undefined;
export const ObserveInstrument=observe?.ObserveInstrument;

@Module({
  imports: observe && telemetryConfig ? [observe.ObserveModule.forRoot(telemetryConfig)] : [],
  controllers: [AppController, DashboardController, DirectorController],
  providers: [AppService, DashboardService],
})
export class AppModule {}