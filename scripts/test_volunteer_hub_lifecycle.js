import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Store } from '../data/store.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Wing from '../models/Wing.js';

async function runVolunteerHubTest() {
  console.log('--- STARTING VOLUNTEER HUB LIFECYCLE TEST ---');
  await connectDB();

  try {
    // 1. Pick a wing
    const wings = await Store.getWings();
    const testWing = wings[0];
    console.log(`✓ Using operational wing: ${testWing?.nameEn} (${testWing?._id})`);

    // 2. Create or find a test member
    const testEmail = `vol_test_${Date.now()}@example.com`;
    const memberUser = await Store.createUser({
      name: 'Test Member For Volunteer Hub',
      email: testEmail,
      password: 'password123',
      role: 'member',
      phone: '01700998877',
      memberId: `WCC-TEST-${Date.now().toString().slice(-4)}`
    });
    console.log(`✓ Created test general member: ${memberUser.name} (${memberUser.email}, role: ${memberUser.role})`);

    // 3. Admin sends Volunteer nomination invitation
    const invitation = await Store.createNotification({
      recipientUserId: memberUser._id,
      recipientMemberId: memberUser.memberId,
      recipientEmail: memberUser.email,
      recipientName: memberUser.name,
      senderId: 'admin',
      senderName: 'WCC Central Administration',
      type: 'role_invitation',
      title: '🎉 Volunteer Corps Nomination: You\'re Invited to Join!',
      message: `Administration has nominated you to join the Volunteer Corps under ${testWing.nameEn}.`,
      targetRole: 'volunteer',
      targetWing: `${testWing.nameBn} (${testWing.nameEn})`,
      targetWingId: String(testWing._id),
      status: 'pending'
    });
    console.log(`✓ Admin sent volunteer nomination: ${invitation._id}, status: ${invitation.status}`);

    // 4. Member checks pending notifications
    const myNotifs = await Store.getMyNotifications({
      userId: memberUser._id,
      email: memberUser.email,
      status: 'pending'
    });
    const foundInv = myNotifs.find(n => String(n._id) === String(invitation._id));
    if (!foundInv) {
      throw new Error('Pending nomination invitation not found for member!');
    }
    console.log(`✓ Member found pending role invitation: ${foundInv.title}`);

    // 5. Member accepts the volunteer nomination
    const respondResult = await Store.respondToRoleInvitation(foundInv._id, {
      action: 'accept',
      recipientUser: memberUser
    });
    console.log(`✓ Member accepted nomination! Result target role: ${respondResult.notification.targetRole}`);

    // 6. Verify role upgraded in MongoDB
    const upgradedUser = await Store.getUserById(memberUser._id);
    if (upgradedUser.role !== 'volunteer') {
      throw new Error(`Expected role 'volunteer', but got '${upgradedUser.role}'`);
    }
    console.log(`✓ Verified User Role updated to: ${upgradedUser.role}, volunteerWing: ${upgradedUser.volunteerWing}`);

    // 7. Admin reassigns volunteer wing
    const secondWing = wings[1] || wings[0];
    const reassignedUser = await Store.updateUser(memberUser._id, {
      volunteerWing: `${secondWing.nameBn} (${secondWing.nameEn})`,
      assignedWing: secondWing._id
    });
    console.log(`✓ Admin reassigned volunteer wing to: ${reassignedUser.volunteerWing}`);

    // 8. Admin demotes volunteer back to General Member
    const demotedUser = await Store.updateUser(memberUser._id, {
      role: 'member',
      assignedWing: null
    });
    console.log(`✓ Admin demoted volunteer back to general member: role: ${demotedUser.role}`);

    // 9. Cleanup
    await User.findByIdAndDelete(memberUser._id);
    await Notification.findByIdAndDelete(invitation._id);
    console.log('✓ Cleaned up test records');

    console.log('--- ALL VOLUNTEER HUB TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runVolunteerHubTest();
