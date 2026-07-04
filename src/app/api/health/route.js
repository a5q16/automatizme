/**
 * Health Check Endpoint
 * GET /api/health
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'digiseller-telegram-bridge',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: {
      hasDigisellerKey: !!process.env.DIGISELLER_API_KEY,
      hasCanbosoKey: !!process.env.CANBOSO_API_KEY,
      hasTelegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
      hasFirebase: !!process.env.FIREBASE_PROJECT_ID,
      hasCronSecret: !!process.env.CRON_SECRET,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
    },
  });
}
