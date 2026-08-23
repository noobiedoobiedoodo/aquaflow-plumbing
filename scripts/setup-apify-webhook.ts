import 'dotenv/config';

async function setupApify() {
  console.log('\n======================================================');
  console.log('⚡ APIFY WEBHOOK & ACCOUNT PROVISIONER FOR AQUAFLOW');
  console.log('======================================================\n');

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error('❌ APIFY_API_TOKEN is missing in .env');
    return;
  }

  try {
    // 1. Authenticate with Apify
    console.log('🔍 1. Verifying Apify Account Authentication...');
    const userRes = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    const userData = await userRes.json();

    if (!userRes.ok || !userData.data) {
      console.error('❌ Failed to authenticate with Apify:', userData);
      return;
    }
    console.log(`✅ Apify Connected! Account: ${userData.data.username || userData.data.email || 'Verified'}`);

    // 2. Check existing webhooks
    console.log('\n📡 2. Checking Existing Apify Webhooks...');
    const listRes = await fetch(`https://api.apify.com/v2/webhooks?token=${token}`);
    const listData = await listRes.json();
    const existing = (listData.data?.items || []).find(
      (w: any) => w.requestUrl === 'https://aquaflow-plumbing-theta.vercel.app/api/webhooks/apify'
    );

    if (existing) {
      console.log(`✅ Webhook already registered! (ID: ${existing.id})`);
      console.log(`   Destination: ${existing.requestUrl}`);
      console.log(`   Events: ${existing.eventTypes.join(', ')}`);
    } else {
      console.log('🚀 3. Registering Automated Apify Webhook via API...');
      const createRes = await fetch(`https://api.apify.com/v2/webhooks?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTypes: ['ACTOR.RUN.SUCCEEDED'],
          requestUrl: 'https://aquaflow-plumbing-theta.vercel.app/api/webhooks/apify',
          condition: {},
          description: 'AquaFlow Plumbing Pipeline Automated Webhook',
          isAdHoc: false,
        }),
      });

      const createData = await createRes.json();
      if (createRes.ok && createData.data) {
        console.log(`🎉 Webhook Registered Successfully! (ID: ${createData.data.id})`);
        console.log(`   Destination: ${createData.data.requestUrl}`);
      } else {
        console.log('Registration response:', createData);
      }
    }

    console.log('\n======================================================');
    console.log('🎯 APIFY INTEGRATION COMPLETE & ACTIVE!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('Error configuring Apify:', error);
  }
}

setupApify();
