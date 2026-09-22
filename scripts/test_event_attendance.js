import jwt from 'jsonwebtoken';

async function runAttendanceTests() {
  console.log('--- [Event Attendance API Test Suite] Starting ---');

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production';

  const adminToken = jwt.sign(
    { id: 'adm_att_test', email: 'admin@wecanchange.org', role: 'admin', name: 'Admin Att Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const memberToken = jwt.sign(
    { id: '6ab2e2076b0168ced5721bb1', email: 'member_att@wecanchange.org', role: 'member', name: 'Member Att' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const memberHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` };
  const publicHeaders = { 'Content-Type': 'application/json' };

  let total = 0;
  let passed = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
  }

  // 1. Fetch wings
  const wingsRes = await fetch(`${baseUrl}/api/wings`);
  const wings = await wingsRes.json();
  const wing1Id = wings[0]._id;
  const wing2Id = wings[1]?._id || wings[0]._id;

  const coord1Token = jwt.sign(
    { id: 'coord1_att_test', email: 'coord1@wecanchange.org', role: 'coordinator', name: 'Coord One', assignedWing: wing1Id },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const coord2Token = jwt.sign(
    { id: 'coord2_att_test', email: 'coord2@wecanchange.org', role: 'coordinator', name: 'Coord Two', assignedWing: wing2Id },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const coord1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${coord1Token}` };
  const coord2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${coord2Token}` };

  // 2. Create an event
  const createEvtRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Youth Leadership Workshop',
      wingId: wing1Id,
      date: new Date(Date.now() + 86400000 * 3),
      location: 'Community Center',
      capacity: 10,
      status: 'published'
    })
  });
  const event = (await createEvtRes.json()).event;
  const eventId = event._id;

  // 3. Register member for the event
  const regRes = await fetch(`${baseUrl}/api/events/${eventId}/register`, {
    method: 'POST',
    headers: memberHeaders
  });
  const registration = (await regRes.json()).registration;
  assert(regRes.status === 201, `Member registered for event (ID: ${registration._id})`);

  // TEST 1: Attendance without authentication -> 401
  const resNoAuth = await fetch(`${baseUrl}/api/events/${eventId}/attendance`, {
    method: 'PATCH',
    headers: publicHeaders,
    body: JSON.stringify({ userId: '6ab2e2076b0168ced5721bb1', attended: true })
  });
  assert(resNoAuth.status === 401, 'PATCH /api/events/:id/attendance without token returns 401');

  // TEST 2: Attendance with Member role -> 403
  const resMember = await fetch(`${baseUrl}/api/events/${eventId}/attendance`, {
    method: 'PATCH',
    headers: memberHeaders,
    body: JSON.stringify({ userId: '6ab2e2076b0168ced5721bb1', attended: true })
  });
  assert(resMember.status === 403, 'PATCH /api/events/:id/attendance with member token returns 403');

  // TEST 3: Attendance on non-registered participant -> 400
  const resNotReg = await fetch(`${baseUrl}/api/events/${eventId}/attendance`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ userId: '6ab2e2076b0168ced5721999', attended: true })
  });
  assert(resNotReg.status === 400, 'PATCH /api/events/:id/attendance for non-registered user returns 400');

  // TEST 4: Attendance by Coordinator of different wing -> 403
  if (String(wing1Id) !== String(wing2Id)) {
    const resOtherCoord = await fetch(`${baseUrl}/api/events/${eventId}/attendance`, {
      method: 'PATCH',
      headers: coord2Headers,
      body: JSON.stringify({ userId: '6ab2e2076b0168ced5721bb1', attended: true })
    });
    assert(resOtherCoord.status === 403, 'PATCH /api/events/:id/attendance by other wing coordinator returns 403');
  }

  // TEST 5: Mark attended = true by Coordinator of matching wing -> 200
  const resCoordAttended = await fetch(`${baseUrl}/api/events/${eventId}/attendance`, {
    method: 'PATCH',
    headers: coord1Headers,
    body: JSON.stringify({
      attendees: [{ userId: '6ab2e2076b0168ced5721bb1', attended: true }]
    })
  });
  assert(resCoordAttended.status === 200, 'Coordinator marks participant as attended = true (200)');
  const coordData = await resCoordAttended.json();
  assert(coordData.updatedCount === 1, 'Updated count is 1');
  assert(coordData.registrations[0]?.attended === true, 'Registration record attended is true');

  // TEST 6: Mark attended = false (no-show) by Admin -> 200
  const resAdminNoShow = await fetch(`${baseUrl}/api/events/${eventId}/attendance`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      attendees: [{ registrationId: registration._id, attended: false }]
    })
  });
  assert(resAdminNoShow.status === 200, 'Admin marks participant as attended = false / no-show (200)');
  const adminData = await resAdminNoShow.json();
  assert(adminData.registrations[0]?.attended === false, 'Registration record attended is now false');

  // TEST 7: AuditLog entry verified for UPDATE_EVENT_ATTENDANCE
  const resAudit = await fetch(`${baseUrl}/api/audit?limit=10`, { headers: adminHeaders });
  const auditLogs = await resAudit.json();
  const foundAttAudit = auditLogs.find(
    log => log.module === 'Events' && log.action === 'UPDATE_EVENT_ATTENDANCE' && log.recordId === String(eventId)
  );
  assert(Boolean(foundAttAudit), 'AuditLog successfully registered UPDATE_EVENT_ATTENDANCE');

  console.log(`\n🎉 ALL ${passed}/${total} Event Attendance API tests PASSED!`);
}

runAttendanceTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });
