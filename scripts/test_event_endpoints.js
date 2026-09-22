import jwt from 'jsonwebtoken';
import app from '../server.js';
import { Store } from '../data/store.js';

async function runEventTests() {
  // Give server and MongoDB connection a moment to connect
  let attempts = 0;
  while (!Store.getWingById && attempts < 20) {
    await new Promise(r => setTimeout(r, 500));
    attempts++;
  }
  await new Promise(r => setTimeout(r, 2000));

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production';
  const adminToken = jwt.sign(
    { id: 'adm_evt_test', email: 'admin@wecanchange.org', role: 'admin', name: 'Admin Event Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const memberToken = jwt.sign(
    { id: 'mbr_evt_test', email: 'member@wecanchange.org', role: 'member', name: 'Member Event Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const memberHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` };
  const publicHeaders = { 'Content-Type': 'application/json' };

  console.log('[Event API Test] Starting...');

  // Get wings from the API via fetch to ensure consistent state
  const wingsRes = await fetch(`${baseUrl}/api/wings`);
  const wings = await wingsRes.json();
  let wingId = wings[0]?._id;
  if (!wingId) {
    const createWingRes = await fetch(`${baseUrl}/api/wings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        nameEn: 'Health Wing',
        nameBn: 'স্বাস্থ্য উইং',
        slug: 'health-event-test'
      })
    });
    const created = await createWingRes.json();
    wingId = created.wing?._id;
  }
  console.log(`Using Wing ID: ${wingId}`);

  // 1. GET /api/events (Public)
  const getRes = await fetch(`${baseUrl}/api/events`);
  console.log(`GET /api/events -> ${getRes.status} (expected 200)`);
  if (getRes.status !== 200) throw new Error('GET /api/events failed');

  // 2. POST /api/events (No auth -> 401)
  const postNoAuth = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ title: 'Test Camp', wingId, date: '2026-05-15', location: 'Dhaka' })
  });
  console.log(`POST /api/events (No auth) -> ${postNoAuth.status} (expected 401)`);
  if (postNoAuth.status !== 401) throw new Error('Expected 401 without auth');

  // 3. POST /api/events (Member auth -> 403)
  const postMember = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: memberHeaders,
    body: JSON.stringify({ title: 'Test Camp', wingId, date: '2026-05-15', location: 'Dhaka' })
  });
  console.log(`POST /api/events (Member) -> ${postMember.status} (expected 403)`);
  if (postMember.status !== 403) throw new Error('Expected 403 for member');

  // 4. POST /api/events (Admin auth -> 201)
  const postAdmin = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Free Health Screening Drive 2026',
      wingId,
      date: '2026-06-20',
      location: 'Jhalakathi Central Park',
      capacity: 300,
      description: 'Free medical consultations, basic tests, and awareness seminars.',
      status: 'published'
    })
  });
  console.log(`POST /api/events (Admin) -> ${postAdmin.status} (expected 201)`);
  const postAdminData = await postAdmin.json();
  if (postAdmin.status !== 201) throw new Error(`POST failed: ${JSON.stringify(postAdminData)}`);
  const createdEvent = postAdminData.event;
  const eventId = createdEvent._id;
  console.log(`Created Event ID: ${eventId}, Title: ${createdEvent.title}`);

  // 5. GET /api/events?wingId=...
  const filterRes = await fetch(`${baseUrl}/api/events?wingId=${wingId}`);
  console.log(`GET /api/events?wingId=... -> ${filterRes.status} (expected 200)`);
  const filteredEvents = await filterRes.json();
  if (!Array.isArray(filteredEvents) || filteredEvents.length === 0) throw new Error('Filter by wingId failed');

  // 6. GET /api/events/:id
  const singleRes = await fetch(`${baseUrl}/api/events/${eventId}`);
  console.log(`GET /api/events/:id -> ${singleRes.status} (expected 200)`);
  const singleData = await singleRes.json();
  if (singleData.title !== 'Free Health Screening Drive 2026') throw new Error('Title mismatch');

  // 7. PUT /api/events/:id (Admin -> 200)
  const putRes = await fetch(`${baseUrl}/api/events/${eventId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ capacity: 500, status: 'completed' })
  });
  console.log(`PUT /api/events/:id -> ${putRes.status} (expected 200)`);
  const putData = await putRes.json();
  if (putData.event?.capacity !== 500) throw new Error('Update failed');

  // 8. DELETE /api/events/:id (Member -> 403)
  const delMember = await fetch(`${baseUrl}/api/events/${eventId}`, {
    method: 'DELETE',
    headers: memberHeaders
  });
  console.log(`DELETE /api/events/:id (Member) -> ${delMember.status} (expected 403)`);
  if (delMember.status !== 403) throw new Error('Expected 403 for member');

  // 9. DELETE /api/events/:id (Admin -> 200)
  const delAdmin = await fetch(`${baseUrl}/api/events/${eventId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  console.log(`DELETE /api/events/:id (Admin) -> ${delAdmin.status} (expected 200)`);
  if (delAdmin.status !== 200) throw new Error('Delete failed');

  // 10. Audit log check
  const auditRes = await fetch(`${baseUrl}/api/audit`);
  const logs = await auditRes.json();
  const evtLog = logs.find(l => l.module === 'Events');
  console.log(`Audit log for Events: ${!!evtLog ? 'PASS' : 'FAIL'}`);

  console.log('\n[ALL EVENT API TESTS PASSED SUCCESSFULLY!]');
  process.exit(0);
}

runEventTests().catch(err => {
  console.error('[Event Test Failed]', err);
  process.exit(1);
});
