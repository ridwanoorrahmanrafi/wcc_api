/**
 * Automated Test Suite: Forgot Password & User Profile Management
 */
import { Store } from '../data/store.js';
import { getSentEmails, clearSentEmails } from '../services/emailService.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runTests() {
  console.log('--- [Forgot Password & Profile Management Test Suite] Starting ---');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Create a test user for password reset
    const testEmail = `reset_user_${Date.now()}@example.com`;
    const initialPassword = 'InitialSecretPass123';
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reset Test User',
        email: testEmail,
        password: initialPassword,
        role: 'member',
        phone: '01799887766'
      })
    });
    const regData = await registerRes.json();
    assert(registerRes.status === 201, 'Test user registered successfully');
    const memberId = regData.user?.memberId;

    // 2. Request forgot-password
    const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    assert(forgotRes.status === 200, 'POST /api/auth/forgot-password returned 200');
    const forgotData = await forgotRes.json();
    assert(Boolean(forgotData.devResetToken), 'Reset token generated in test/dev environment');
    const resetToken = forgotData.devResetToken;

    // 3. Verify reset token
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-reset-token?token=${resetToken}`);
    assert(verifyRes.status === 200, 'GET /api/auth/verify-reset-token returned 200 for valid token');
    const verifyData = await verifyRes.json();
    assert(verifyData.valid === true, 'Token is verified valid');
    assert(verifyData.email === testEmail, 'Token belongs to correct user');

    // 4. Verify invalid token rejection
    const invalidVerifyRes = await fetch(`${BASE_URL}/auth/verify-reset-token?token=bogus_token_12345`);
    assert(invalidVerifyRes.status === 400, 'Invalid token returns 400');

    // 5. Reset Password
    const newPassword = 'NewSecretPass456';
    const resetPassRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword
      })
    });
    assert(resetPassRes.status === 200, 'POST /api/auth/reset-password returned 200');

    // 6. Old token should now be consumed/invalidated
    const reusedVerifyRes = await fetch(`${BASE_URL}/auth/verify-reset-token?token=${resetToken}`);
    assert(reusedVerifyRes.status === 400, 'Consumed reset token cannot be reused');

    // 7. Login with old password fails
    const oldLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: initialPassword })
    });
    assert(oldLoginRes.status === 401, 'Old password fails login after reset');

    // 8. Login with new password succeeds
    const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: newPassword })
    });
    assert(newLoginRes.status === 200, 'New password successfully authenticates');
    const loginData = await newLoginRes.json();
    const userToken = loginData.token;

    // 9. Fetch Profile
    const profileRes = await fetch(`${BASE_URL}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert(profileRes.status === 200, 'GET /api/auth/profile returned 200');
    const profileData = await profileRes.json();
    assert(profileData.user?.email === testEmail, 'Profile email matches');

    // 10. Update Profile (Name, Phone, Blood Group, Upazila, Profession, Bio, Avatar)
    const updateRes = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        name: 'Tanvir Hossain Updated',
        phone: '01811223344',
        blood: 'B+',
        upazila: 'নলছিটি',
        district: 'ঝালকাঠি',
        profession: 'Software Engineer',
        bio: 'Dedicated volunteer helping our community.',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
      })
    });
    assert(updateRes.status === 200, 'PUT /api/auth/profile returned 200');
    const updatedData = await updateRes.json();
    assert(updatedData.user?.name === 'Tanvir Hossain Updated', 'User name updated');
    assert(updatedData.user?.blood === 'B+', 'User blood group updated');
    assert(updatedData.user?.upazila === 'নলছিটি', 'User upazila updated');
    assert(updatedData.user?.profession === 'Software Engineer', 'User profession updated');

    // 11. Verify linked Member record was synced in MongoDB
    if (memberId) {
      const memberRes = await fetch(`${BASE_URL}/members/${memberId}`);
      if (memberRes.status === 200) {
        const memberData = await memberRes.json();
        assert(memberData.blood === 'B+', 'Linked Member record blood group synced to B+');
        assert(memberData.upazila === 'নলছিটি', 'Linked Member record upazila synced to নলছিটি');
        assert(memberData.profession === 'Software Engineer', 'Linked Member record profession synced');
      }
    }

    // 12. Change Password while authenticated
    // Wrong current password fails
    const badChangeRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword999',
        newPassword: 'EvenNewerPassword789'
      })
    });
    assert(badChangeRes.status === 400, 'Change password with wrong current password rejected with 400');

    // Correct current password succeeds
    const goodChangeRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        currentPassword: newPassword,
        newPassword: 'EvenNewerPassword789'
      })
    });
    assert(goodChangeRes.status === 200, 'Change password with correct current password succeeds with 200');

    // Verify login with latest password
    const latestLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'EvenNewerPassword789' })
    });
    assert(latestLoginRes.status === 200, 'Login with updated password succeeds');

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  }

  console.log(`\n--- Test Results: ${passCount} passed, ${failCount} failed ---`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
