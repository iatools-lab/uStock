import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
@Controller('api/dg')
export class DirectorController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('overview') overview(@Query() query: Record<string, string>) {
    return this.dashboard.directorOverview(query);
  }
  @Get('stock') stock(@Query() query: Record<string, string>) {
    return this.dashboard.directorStock(query);
  }
  @Get('filters') filters(@Query() query: Record<string, string>) {
    return this.dashboard.directorFilters(query);
  }
  @Get('stock-daily') daily(@Query() query:Record<string,string>){return this.dashboard.directorDaily(query);}
}
