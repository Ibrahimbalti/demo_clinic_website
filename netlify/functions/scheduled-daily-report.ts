import type { Config, Handler } from '@netlify/functions';
import { clinicStore } from '../../src/lib/clinicDataStore';
import { jsonResponse } from './_shared/security';

/**
 * Netlify Scheduled Function: Automated Daily Clinic Owner Report
 * Runs daily at 06:00 UTC (configurable to clinic timezone).
 */
export const handler: Handler = async () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const report = clinicStore.generateDailyReport(todayStr);

  return jsonResponse(200, {
    success: true,
    generatedAt: new Date().toISOString(),
    report,
  });
};

export const config: Config = {
  schedule: '0 6 * * *',
};
