// ─────────────────────────────────────────────────────────────
// scripts/create-admin.js — create (or reset) an admin login for the
// Amja admin panel and grant it the admin:true claim in one step.
// Local only. Uses scripts/serviceAccountKey.json (never commit it).
//
//   node scripts/create-admin.js you@example.com "Your-Strong-Password"
//
// Running it again with the same email resets that user's password.
// ─────────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('\n❌ Missing scripts/serviceAccountKey.json (Firebase console → Project settings → Service accounts → Generate new private key).\n');
  process.exit(1);
}
const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('\nUsage: node scripts/create-admin.js <email> "<password, min 8 chars>"\n');
  process.exit(1);
}

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
initializeApp({ credential: cert(require(keyPath)) });

(async () => {
  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, emailVerified: true, disabled: false });
    console.log(`\n🔁 Existing user ${email} — password updated.`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({ email, password, emailVerified: true });
    console.log(`\n✅ Created user ${email}.`);
  }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log('✅ Admin access granted. Sign in at /admin/ on the Amja Tours site.\n');
  process.exit(0);
})().catch(e => { console.error('\n❌', e.message, '\n'); process.exit(1); });
