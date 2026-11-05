import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('overview') overview(@Query() query: Record<string, string>) {
    return this.dashboard.overview(query);
  }
  @Get('stock') stock(@Query() query: Record<string, string>) {
    return this.dashboard.stock(query);
  }
  @Get('quality') quality() {
    return this.dashboard.quality();
  }
}
