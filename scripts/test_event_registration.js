import jwt from 'jsonwebtoken';

async function runEventRegistrationTests() {
  console.log('--- [Event Registration API Test Suite] Starting ---');

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production';

  const adminToken = jwt.sign(
    { id: 'adm_reg_test', email: 'admin@wecanchange.org', role: 'admin', name: 'Admin Reg Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const member1Token = jwt.sign(
    { id: '6ab2e2076b0168ced5721aa1', email: 'member1@wecanchange.org', role: 'member', name: 'Member One' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const member2Token = jwt.sign(
    { id: '6ab2e2076b0168ced5721aa2', email: 'member2@wecanchange.org', role: 'member', name: 'Member Two' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const member3Token = jwt.sign(
    { id: '6ab2e2076b0168ced5721aa3', email: 'member3@wecanchange.org', role: 'member', name: 'Member Three' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const member1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${member1Token}` };
  const member2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${member2Token}` };
  const member3Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${member3Token}` };
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

  // 1. Fetch wings to get a wingId
  const wingsRes = await fetch(`${baseUrl}/api/wings`);
  const wings = await wingsRes.json();
  const wing1 = wings[0];
  const wing2 = wings[1] || wings[0];
  const wing1Id = wing1._id;
  const wing2Id = wing2._id;

  // Coordinator for wing1 and wing2
  const coord1Token = jwt.sign(
    { id: 'coord1_reg_test', email: 'coord1@wecanchange.org', role: 'coordinator', name: 'Coord One', assignedWing: wing1Id },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const coord2Token = jwt.sign(
    { id: 'coord2_reg_test', email: 'coord2@wecanchange.org', role: 'coordinator', name: 'Coord Two', assignedWing: wing2Id },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const coord1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${coord1Token}` };
  const coord2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${coord2Token}` };

  // 2. Create a test event with capacity: 2
  const createEvtRes = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Civic Tree Plantation Drive',
      wingId: wing1Id,
      date: new Date(Date.now() + 86400000 * 5),
      location: 'Gabkhan Bridge Eco Park',
      capacity: 2,
      description: 'Annual tree plantation drive organized for volunteers and members.',
      status: 'published'
    })
  });
  const createData = await createEvtRes.json();
  const testEvent = createData.event;
  const eventId = testEvent._id;
  assert(createEvtRes.status === 201, `Created test event with capacity 2: ${testEvent.title} (ID: ${eventId})`);

  // TEST 1: Register without authentication -> 401
  const resNoAuth = await fetch(`${baseUrl}/api/events/${eventId}/register`, {
    method: 'POST',
    headers: publicHeaders
  });
  assert(resNoAuth.status === 401, 'POST /api/events/:id/register without token returns 401');

  // TEST 2: Register for non-existent event -> 404
  const resNotFound = await fetch(`${baseUrl}/api/events/6ab2e2076b0168ced5721999/register`, {
    method: 'POST',
    headers: member1Headers
  });
  assert(resNotFound.status === 404, 'POST /api/events/:id/register with invalid event returns 404');

  // TEST 3: Create cancelled event and attempt registration -> 400
  const createCancelled = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Cancelled Flood Awareness Session',
      wingId: wing1Id,
      date: new Date(Date.now() + 86400000),
      location: 'Town Hall',
      capacity: 10,
      status: 'cancelled'
    })
  });
  const cancelledEvt = (await createCancelled.json()).event;
  const resCancelledReg = await fetch(`${baseUrl}/api/events/${cancelledEvt._id}/register`, {
    method: 'POST',
    headers: member1Headers
  });
  assert(resCancelledReg.status === 400, 'POST /api/events/:id/register on cancelled event returns 400');

  // TEST 4: Successful registration for Member 1 -> 201
  const resReg1 = await fetch(`${baseUrl}/api/events/${eventId}/register`, {
    method: 'POST',
    headers: member1Headers
  });
  assert(resReg1.status === 201, 'POST /api/events/:id/register registers Member 1 with 201');
  const reg1Data = await resReg1.json();
  assert(reg1Data.registration.attended === false, 'Registration default attended is false');

  // TEST 5: Check my-registration for Member 1 -> 200 with registered: true
  const resMyReg1 = await fetch(`${baseUrl}/api/events/${eventId}/my-registration`, {
    headers: member1Headers
  });
  assert(resMyReg1.status === 200, 'GET /api/events/:id/my-registration returns 200');
  const myReg1Data = await resMyReg1.json();
  assert(myReg1Data.registered === true, 'Member 1 my-registration returns registered: true');

  // TEST 6: Check my-registration for Member 2 (not registered yet) -> registered: false
  const resMyReg2 = await fetch(`${baseUrl}/api/events/${eventId}/my-registration`, {
    headers: member2Headers
  });
  const myReg2Data = await resMyReg2.json();
  assert(myReg2Data.registered === false, 'Member 2 my-registration returns registered: false');

  // TEST 7: Duplicate registration for Member 1 -> 400
  const resDup = await fetch(`${baseUrl}/api/events/${eventId}/register`, {
    method: 'POST',
    headers: member1Headers
  });
  assert(resDup.status === 400, 'POST /api/events/:id/register duplicate registration returns 400');

  // TEST 8: Successful registration for Member 2 (Capacity 2 of 2 filled) -> 201
  const resReg2 = await fetch(`${baseUrl}/api/events/${eventId}/register`, {
    method: 'POST',
    headers: member2Headers
  });
  assert(resReg2.status === 201, 'POST /api/events/:id/register registers Member 2 with 201 (Capacity filled)');

  // TEST 9: Member 3 attempts registration when capacity is reached -> 400
  const resReg3 = await fetch(`${baseUrl}/api/events/${eventId}/register`, {
    method: 'POST',
    headers: member3Headers
  });
  assert(resReg3.status === 400, 'POST /api/events/:id/register rejects registration when capacity is reached');
  const reg3Data = await resReg3.json();
  assert(reg3Data.error && reg3Data.error.includes('capacity'), 'Error message mentions capacity reached');

  // TEST 10: GET /api/events/:id returns updated registeredCount: 2 and isFull: true
  const resGetEvt = await fetch(`${baseUrl}/api/events/${eventId}`);
  const evtDetails = await resGetEvt.json();
  assert(evtDetails.registeredCount === 2, `Event registeredCount is 2 (got ${evtDetails.registeredCount})`);
  assert(evtDetails.isFull === true, 'Event isFull flag is true');

  // TEST 11: GET /api/events/:id/registrations (Admin -> 200)
  const resAdminList = await fetch(`${baseUrl}/api/events/${eventId}/registrations`, {
    headers: adminHeaders
  });
  assert(resAdminList.status === 200, 'GET /api/events/:id/registrations with admin token returns 200');
  const adminListData = await resAdminList.json();
  assert(adminListData.total === 2, `Admin sees 2 registrations (got ${adminListData.total})`);

  // TEST 12: GET /api/events/:id/registrations (Coordinator for Wing 1 -> 200)
  const resCoord1List = await fetch(`${baseUrl}/api/events/${eventId}/registrations`, {
    headers: coord1Headers
  });
  assert(resCoord1List.status === 200, 'GET /api/events/:id/registrations for event wing coordinator returns 200');

  // TEST 13: GET /api/events/:id/registrations (Coordinator for different Wing 2 -> 403)
  if (String(wing1Id) !== String(wing2Id)) {
    const resCoord2List = await fetch(`${baseUrl}/api/events/${eventId}/registrations`, {
      headers: coord2Headers
    });
    assert(resCoord2List.status === 403, 'GET /api/events/:id/registrations for other wing coordinator returns 403');
  }

  // TEST 14: Check AuditLog recorded REGISTER_EVENT
  const resAudit = await fetch(`${baseUrl}/api/audit?limit=10`, { headers: adminHeaders });
  const auditLogs = await resAudit.json();
  const foundRegAudit = auditLogs.find(
    log => log.module === 'Events' && log.action === 'REGISTER_EVENT' && log.recordId === String(eventId)
  );
  assert(Boolean(foundRegAudit), 'AuditLog successfully registered REGISTER_EVENT');

  console.log(`\n🎉 ALL ${passed}/${total} Event Registration API tests PASSED!`);
}

runEventRegistrationTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });
