import 'dotenv/config';

async function diagnose() {
  console.log('\n======================================================');
  console.log('🔍 RESEND API DIAGNOSTIC AUDIT');
  console.log('======================================================\n');

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY missing in .env');
    return;
  }
  console.log(`API Key: ${apiKey.slice(0, 8)}... (Length: ${apiKey.length})`);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    console.log(`HTTP Response Status: ${res.status} ${res.statusText}`);
    console.log('Rate Limits & Quota Headers:');
    console.log(`  - Rate Limit Remaining: ${res.headers.get('ratelimit-remaining')} / ${res.headers.get('ratelimit-limit')}`);
    console.log(`  - Daily Quota Used: ${res.headers.get('x-resend-daily-quota')}`);
    console.log(`  - Monthly Quota Used: ${res.headers.get('x-resend-monthly-quota')}`);

    const data = await res.json();
    console.log('\nResend Response Payload:', data);
  } catch (error) {
    console.error('Diagnostic error:', error);
  }

  console.log('\n======================================================\n');
}

diagnose();
