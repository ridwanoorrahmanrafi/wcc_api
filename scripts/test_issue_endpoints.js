import jwt from 'jsonwebtoken';
import { Store } from '../data/store.js';

async function runIssueTests() {
  console.log('--- [Community Issues API Test Suite] Starting ---');

  // Allow server / db time to initialize
  await new Promise(r => setTimeout(r, 1000));

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production';
  const adminToken = jwt.sign(
    { id: 'adm_issue_test', email: 'admin@wecanchange.org', role: 'admin', name: 'Admin Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const coordToken = jwt.sign(
    { id: 'coord_issue_test', email: 'coordinator.education@wecanchange.org', role: 'coordinator', name: 'Edu Coordinator' },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const memberToken = jwt.sign(
    { id: 'mbr_issue_test', email: 'member@wecanchange.org', role: 'member', name: 'Member Tester' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const coordHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${coordToken}` };
  const memberHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` };
  const publicHeaders = { 'Content-Type': 'application/json' };

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
  }

  // TEST 1: POST /api/issues without auth (Validation Failure - missing title)
  const resMissing = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({
      description: 'Broken street light at Hospital Road',
      location: 'Hospital Road, Jhalakathi',
      reporterName: 'Rahim Uddin',
      reporterContact: '01711000000'
    })
  });
  assert(resMissing.status === 400, 'POST /api/issues with missing title returns 400');

  // TEST 2: POST /api/issues without auth (Validation Failure - missing reporterContact)
  const resMissingContact = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({
      title: 'Water logging near market',
      description: 'Severe water logging after rain',
      location: 'Boro Bazar',
      reporterName: 'Rahim Uddin'
    })
  });
  assert(resMissingContact.status === 400, 'POST /api/issues with missing contact returns 400');

  // TEST 3: POST /api/issues SUCCESS (Public submission without authentication)
  const resCreate = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify({
      title: 'Broken Culvert near College Gate',
      description: 'The culvert bridge has cracked open creating severe road danger for school students.',
      location: 'Govt College Road, Jhalakathi Sadar',
      reporterName: 'Tariqul Islam',
      reporterContact: '01819998877',
      photoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=800'
    })
  });
  assert(resCreate.status === 201, 'POST /api/issues creates issue and returns 201');
  const createData = await resCreate.json();
  const createdIssue = createData.issue;
  const issueCode = createData.issueCode;
  assert(Boolean(issueCode), `Issue code generated: ${issueCode}`);
  assert(issueCode.startsWith('ISSUE-'), 'Issue code follows ISSUE-YYYY-XXXXXX format');
  assert(createdIssue.status === 'pending', 'Default status is pending');
  assert(createdIssue.reporterContact === undefined, 'Public response payload strips reporterContact for privacy');

  // TEST 4: Public Tracking GET /api/issues/track/:issueCode
  const resTrack = await fetch(`${baseUrl}/api/issues/track/${issueCode}`);
  assert(resTrack.status === 200, `GET /api/issues/track/${issueCode} returns 200`);
  const trackData = await resTrack.json();
  assert(trackData.issueCode === issueCode, 'Tracking response matches issueCode');
  assert(trackData.status === 'pending', 'Tracking response shows pending status');
  assert(trackData.reporterContact === undefined, 'Tracking response strictly conceals reporterContact');
  assert(trackData._id === undefined, 'Tracking response conceals internal database _id');

  // TEST 5: Public Tracking with invalid code -> 404
  const resTrack404 = await fetch(`${baseUrl}/api/issues/track/ISSUE-9999-NOTFOUND`);
  assert(resTrack404.status === 404, 'GET /api/issues/track/non-existent returns 404');

  // TEST 6: GET /api/issues Protected (Unauthenticated -> 401)
  const resListNoAuth = await fetch(`${baseUrl}/api/issues`);
  assert(resListNoAuth.status === 401, 'GET /api/issues without token returns 401');

  // TEST 7: GET /api/issues Protected (Member role -> 403)
  const resListMember = await fetch(`${baseUrl}/api/issues`, { headers: memberHeaders });
  assert(resListMember.status === 403, 'GET /api/issues with member token returns 403');

  // TEST 8: GET /api/issues Protected (Admin -> 200)
  const resListAdmin = await fetch(`${baseUrl}/api/issues`, { headers: adminHeaders });
  assert(resListAdmin.status === 200, 'GET /api/issues with admin token returns 200');
  const listData = await resListAdmin.json();
  const issuesList = listData.issues || listData;
  assert(Array.isArray(issuesList) && issuesList.length > 0, 'Admin receives non-empty issues list');

  // Locate the created issue from the list
  const foundIssue = issuesList.find(i => i.issueCode === issueCode);
  assert(Boolean(foundIssue), 'Created issue is present in admin listing');
  const issueDbId = foundIssue._id;

  // TEST 9: GET /api/issues/:id Protected (Admin -> 200)
  const resGetSingle = await fetch(`${baseUrl}/api/issues/${issueDbId}`, { headers: adminHeaders });
  assert(resGetSingle.status === 200, `GET /api/issues/${issueDbId} returns 200`);
  const singleData = await resGetSingle.json();
  assert(singleData.reporterContact === '01819998877', 'Admin endpoint can access reporterContact for verification');

  // TEST 10: PATCH /api/issues/:id/status (Invalid status -> 400)
  const resInvalidStatus = await fetch(`${baseUrl}/api/issues/${issueDbId}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'invalid_status_type' })
  });
  assert(resInvalidStatus.status === 400, 'PATCH /api/issues/:id/status with invalid status returns 400');

  // TEST 11: PATCH /api/issues/:id/status (Coordinator -> in_progress, AuditLog recorded)
  const resStatusProgress = await fetch(`${baseUrl}/api/issues/${issueDbId}/status`, {
    method: 'PATCH',
    headers: coordHeaders,
    body: JSON.stringify({ status: 'in_progress' })
  });
  assert(resStatusProgress.status === 200, 'PATCH /api/issues/:id/status to in_progress returns 200');
  const progressData = await resStatusProgress.json();
  assert(progressData.previousStatus === 'pending', 'Status update records previousStatus as pending');
  assert(progressData.newStatus === 'in_progress', 'Status update records newStatus as in_progress');

  // Check AuditLog entry
  const resAudit = await fetch(`${baseUrl}/api/audit?limit=10`, { headers: adminHeaders });
  assert(resAudit.status === 200, 'GET /api/audit returns 200');
  const auditLogs = await resAudit.json();
  const foundAudit = auditLogs.find(
    log => log.module === 'CommunityIssues' && log.action === 'UPDATE_ISSUE_STATUS' && log.recordId === issueCode
  );
  assert(Boolean(foundAudit), `AuditLog successfully registered status change for ${issueCode}`);
  console.log('Audit detail recorded:', foundAudit?.details);

  // TEST 12: Public tracking reflects new status 'in_progress'
  const resTrackUpdated = await fetch(`${baseUrl}/api/issues/track/${issueCode}`);
  const trackUpdatedData = await resTrackUpdated.json();
  assert(trackUpdatedData.status === 'in_progress', 'Public tracking reflects updated in_progress status');

  // TEST 13: PATCH /api/issues/:id/assign (Assign to user)
  // Fetch users to pick a user
  const usersRes = await fetch(`${baseUrl}/api/auth/users`, { headers: adminHeaders });
  let assignedUserId = null;
  if (usersRes.status === 200) {
    const users = await usersRes.json();
    const target = users[0];
    assignedUserId = target?._id;
  }

  if (assignedUserId) {
    const resAssign = await fetch(`${baseUrl}/api/issues/${issueDbId}/assign`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ assignedTo: assignedUserId })
    });
    assert(resAssign.status === 200, 'PATCH /api/issues/:id/assign returns 200');
    const assignData = await resAssign.json();
    assert(Boolean(assignData.issue.assignedTo), 'Issue assignedTo field is updated');
  }

  // TEST 14: PATCH /api/issues/:id/status (Resolve issue)
  const resStatusResolved = await fetch(`${baseUrl}/api/issues/${issueDbId}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'resolved' })
  });
  assert(resStatusResolved.status === 200, 'PATCH /api/issues/:id/status to resolved returns 200');
  const resolvedTrack = await (await fetch(`${baseUrl}/api/issues/track/${issueCode}`)).json();
  assert(resolvedTrack.status === 'resolved', 'Public tracking reflects resolved status');

  console.log(`\n🎉 ALL ${passed}/${total} Community Issue API tests PASSED!`);
}

runIssueTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });
