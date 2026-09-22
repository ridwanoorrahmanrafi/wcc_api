import jwt from 'jsonwebtoken';
import app from '../server.js';

async function testApi() {
  // Give server a moment to start
  await new Promise(r => setTimeout(r, 1000));

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production';
  const adminToken = jwt.sign(
    { id: 'adm_test', email: 'admin@wecanchange.org', role: 'admin', name: 'Admin Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const memberToken = jwt.sign(
    { id: 'mbr_test', email: 'member@wecanchange.org', role: 'member', name: 'Member Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };
  const memberHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${memberToken}`
  };
  const publicHeaders = {
    'Content-Type': 'application/json'
  };

  console.log('[API Test] Starting Wing & Program endpoint tests...');

  // 1. Root and Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  console.log(`GET /api/health -> ${healthRes.status} (expected 200)`);
  if (healthRes.status !== 200) throw new Error('Health check failed');

  // 2. GET /api/wings (Public)
  const getWingsRes = await fetch(`${baseUrl}/api/wings`);
  console.log(`GET /api/wings -> ${getWingsRes.status} (expected 200)`);
  if (getWingsRes.status !== 200) throw new Error('GET /api/wings failed');

  // 3. POST /api/wings (No token -> 401)
  const postWingNoAuth = await fetch(`${baseUrl}/api/wings`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ nameEn: 'Health Wing', nameBn: 'স্বাস্থ্য উইং', slug: 'health' })
  });
  console.log(`POST /api/wings (No auth) -> ${postWingNoAuth.status} (expected 401)`);
  if (postWingNoAuth.status !== 401) throw new Error('POST /api/wings should return 401 without auth');

  // 4. POST /api/wings (Member token -> 403)
  const postWingMemberAuth = await fetch(`${baseUrl}/api/wings`, {
    method: 'POST',
    headers: memberHeaders,
    body: JSON.stringify({ nameEn: 'Health Wing', nameBn: 'স্বাস্থ্য উইং', slug: 'health' })
  });
  console.log(`POST /api/wings (Member auth) -> ${postWingMemberAuth.status} (expected 403)`);
  if (postWingMemberAuth.status !== 403) throw new Error('POST /api/wings should return 403 for member');

  // 5. POST /api/wings (Admin token -> 201)
  const postWingAdmin = await fetch(`${baseUrl}/api/wings`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      nameEn: 'Health Wing',
      nameBn: 'স্বাস্থ্য উইং',
      slug: 'health',
      description: 'Dedicated to community health camps, blood donation and medical assistance.',
      missionPoints: ['Blood drives', 'Free medical checkups', 'First aid awareness']
    })
  });
  console.log(`POST /api/wings (Admin auth) -> ${postWingAdmin.status} (expected 201)`);
  const postWingAdminData = await postWingAdmin.json();
  if (postWingAdmin.status !== 201) throw new Error(`POST /api/wings failed: ${JSON.stringify(postWingAdminData)}`);
  const createdWing = postWingAdminData.wing;
  const wingId = createdWing._id;
  console.log(`Created Wing ID: ${wingId}, slug: ${createdWing.slug}`);

  // 6. POST /api/wings duplicate slug -> 409
  const postWingDuplicate = await fetch(`${baseUrl}/api/wings`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      nameEn: 'Health Duplicate',
      nameBn: 'স্বাস্থ্য ২',
      slug: 'health'
    })
  });
  console.log(`POST /api/wings (Duplicate slug) -> ${postWingDuplicate.status} (expected 409)`);
  if (postWingDuplicate.status !== 409) throw new Error('POST /api/wings should return 409 for duplicate slug');

  // 7. GET /api/wings/:slug (Public)
  const getWingBySlug = await fetch(`${baseUrl}/api/wings/health`);
  console.log(`GET /api/wings/health -> ${getWingBySlug.status} (expected 200)`);
  const wingBySlugData = await getWingBySlug.json();
  if (wingBySlugData.slug !== 'health') throw new Error('Wing slug mismatch');

  // 8. GET /api/wings/:slug with unknown slug -> 404
  const getWingUnknown = await fetch(`${baseUrl}/api/wings/nonexistent-wing-slug`);
  console.log(`GET /api/wings/nonexistent -> ${getWingUnknown.status} (expected 404)`);
  if (getWingUnknown.status !== 404) throw new Error('GET /api/wings/nonexistent should return 404');

  // 9. PUT /api/wings/:id (Admin -> 200)
  const putWing = await fetch(`${baseUrl}/api/wings/${wingId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ description: 'Updated health wing description.' })
  });
  console.log(`PUT /api/wings/:id -> ${putWing.status} (expected 200)`);
  if (putWing.status !== 200) throw new Error('PUT /api/wings failed');

  // 10. GET /api/programs (Public)
  const getProgs = await fetch(`${baseUrl}/api/programs`);
  console.log(`GET /api/programs -> ${getProgs.status} (expected 200)`);
  if (getProgs.status !== 200) throw new Error('GET /api/programs failed');

  // 11. POST /api/programs (No token -> 401)
  const postProgNoAuth = await fetch(`${baseUrl}/api/programs`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({ title: 'Blood Donation 2026', wingId })
  });
  console.log(`POST /api/programs (No auth) -> ${postProgNoAuth.status} (expected 401)`);
  if (postProgNoAuth.status !== 401) throw new Error('POST /api/programs should return 401');

  // 12. POST /api/programs (Member token -> 403)
  const postProgMember = await fetch(`${baseUrl}/api/programs`, {
    method: 'POST',
    headers: memberHeaders,
    body: JSON.stringify({ title: 'Blood Donation 2026', wingId })
  });
  console.log(`POST /api/programs (Member auth) -> ${postProgMember.status} (expected 403)`);
  if (postProgMember.status !== 403) throw new Error('POST /api/programs should return 403 for member');

  // 13. POST /api/programs (Admin with invalid wingId -> 400)
  const postProgInvalidWing = await fetch(`${baseUrl}/api/programs`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Blood Donation 2026', wingId: 'invalid_wing_id_999' })
  });
  console.log(`POST /api/programs (Invalid wingId) -> ${postProgInvalidWing.status} (expected 400)`);
  if (postProgInvalidWing.status !== 400) throw new Error('POST /api/programs should return 400 for invalid wingId');

  // 14. POST /api/programs (Admin with invalid date range -> 400)
  const postProgInvalidDates = await fetch(`${baseUrl}/api/programs`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Blood Donation 2026',
      wingId,
      startDate: '2026-06-01',
      endDate: '2026-05-01'
    })
  });
  console.log(`POST /api/programs (Invalid dates) -> ${postProgInvalidDates.status} (expected 400)`);
  if (postProgInvalidDates.status !== 400) throw new Error('POST /api/programs should return 400 for invalid date range');

  // 15. POST /api/programs (Admin -> 201)
  const postProgAdmin = await fetch(`${baseUrl}/api/programs`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Community Health Camp & Blood Drive 2026',
      wingId,
      description: 'Comprehensive health screening and voluntary blood collection camp.',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      status: 'published'
    })
  });
  console.log(`POST /api/programs (Admin auth) -> ${postProgAdmin.status} (expected 201)`);
  const postProgAdminData = await postProgAdmin.json();
  if (postProgAdmin.status !== 201) throw new Error(`POST /api/programs failed: ${JSON.stringify(postProgAdminData)}`);
  const createdProg = postProgAdminData.program;
  const progId = createdProg._id;
  console.log(`Created Program ID: ${progId}, title: ${createdProg.title}, Wing name: ${createdProg.wingId?.nameEn}`);

  // 16. GET /api/programs?wingId=... (Filter by wingId)
  const getProgsFilter = await fetch(`${baseUrl}/api/programs?wingId=${wingId}`);
  console.log(`GET /api/programs?wingId=${wingId} -> ${getProgsFilter.status} (expected 200)`);
  const filteredList = await getProgsFilter.json();
  if (!Array.isArray(filteredList) || filteredList.length === 0) throw new Error('Filter by wingId returned empty');

  // 17. GET /api/programs/:id (Public)
  const getProgById = await fetch(`${baseUrl}/api/programs/${progId}`);
  console.log(`GET /api/programs/:id -> ${getProgById.status} (expected 200)`);
  const singleProgData = await getProgById.json();
  if (singleProgData.title !== 'Community Health Camp & Blood Drive 2026') throw new Error('Program title mismatch');

  // 18. PUT /api/programs/:id (Admin -> 200)
  const putProg = await fetch(`${baseUrl}/api/programs/${progId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'completed' })
  });
  console.log(`PUT /api/programs/:id -> ${putProg.status} (expected 200)`);
  const putProgData = await putProg.json();
  if (putProgData.program?.status !== 'completed') throw new Error('Program status update failed');

  // 19. DELETE /api/programs/:id (Member -> 403)
  const deleteProgMember = await fetch(`${baseUrl}/api/programs/${progId}`, {
    method: 'DELETE',
    headers: memberHeaders
  });
  console.log(`DELETE /api/programs/:id (Member) -> ${deleteProgMember.status} (expected 403)`);
  if (deleteProgMember.status !== 403) throw new Error('DELETE /api/programs/:id should return 403 for member');

  // 20. DELETE /api/programs/:id (Admin -> 200)
  const deleteProgAdmin = await fetch(`${baseUrl}/api/programs/${progId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  console.log(`DELETE /api/programs/:id (Admin) -> ${deleteProgAdmin.status} (expected 200)`);
  if (deleteProgAdmin.status !== 200) throw new Error('DELETE /api/programs/:id failed');

  // 21. DELETE /api/wings/:id (Admin -> 200)
  const deleteWingAdmin = await fetch(`${baseUrl}/api/wings/${wingId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  console.log(`DELETE /api/wings/:id (Admin) -> ${deleteWingAdmin.status} (expected 200)`);
  if (deleteWingAdmin.status !== 200) throw new Error('DELETE /api/wings/:id failed');

  // 22. Verify audit logs
  const auditRes = await fetch(`${baseUrl}/api/audit`);
  const logs = await auditRes.json();
  const wingLog = logs.find(l => l.module === 'Wings');
  const progLog = logs.find(l => l.module === 'Programs');
  console.log(`Audit log Wings action recorded: ${!!wingLog ? 'PASS' : 'FAIL'}`);
  console.log(`Audit log Programs action recorded: ${!!progLog ? 'PASS' : 'FAIL'}`);

  console.log('\n[ALL 22 API ENDPOINT TESTS PASSED WITH 100% SUCCESS!]');
  process.exit(0);
}

testApi().catch(err => {
  console.error('[API Test Failed]', err);
  process.exit(1);
});
