/**
 * Test Suite for Task 15: MVP Impact Statistics API
 * Tests GET /api/stats/impact and verifies that changing an issue
 * from in_progress to resolved updates the resolvedIssues count.
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runTests() {
  console.log('--- [MVP Impact Statistics Test Suite] Starting ---');
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
    // 1. Fetch initial impact stats
    const initRes = await fetch(`${BASE_URL}/stats/impact`);
    assert(initRes.status === 200, `GET /api/stats/impact returned 200 (Got: ${initRes.status})`);

    const initialStats = await initRes.json();
    console.log('Initial stats:', initialStats);
    assert(typeof initialStats.totalPrograms === 'number', 'totalPrograms is a number');
    assert(typeof initialStats.totalVolunteers === 'number', 'totalVolunteers is a number');
    assert(typeof initialStats.resolvedIssues === 'number', 'resolvedIssues is a number');

    // 2. Login as admin to get token for issue management
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wecanchange.org', password: 'wccadmin2026' })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.token;
    assert(!!adminToken, 'Admin login succeeded and token retrieved');

    // 3. Create a test issue (initially pending)
    const issuePayload = {
      title: `Impact Stats Test Issue ${Date.now()}`,
      description: 'Testing resolvedIssues metric transition from in_progress to resolved',
      location: 'Ward 4, Jhalakathi',
      reporterName: 'Tester Impact',
      reporterContact: 'tester@wecanchange.org'
    };

    const createIssueRes = await fetch(`${BASE_URL}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issuePayload)
    });
    assert(createIssueRes.status === 201, 'Test issue created successfully');
    const createIssueData = await createIssueRes.json();
    const issueCode = createIssueData.issueCode;
    assert(!!issueCode, `Issue code generated: ${issueCode}`);

    // Retrieve issue internal _id via authorized admin lookup
    const listRes = await fetch(`${BASE_URL}/issues?search=${encodeURIComponent(issueCode)}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const listData = await listRes.json();
    const issueId = listData.issues?.[0]?._id;
    assert(!!issueId, `Issue ID obtained via admin search: ${issueId}`);

    // 4. Update status to in_progress
    const inProgressRes = await fetch(`${BASE_URL}/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert(inProgressRes.status === 200, 'Issue transitioned to in_progress');

    // 5. Verify resolved count has NOT changed yet
    const midRes = await fetch(`${BASE_URL}/stats/impact`);
    const midStats = await midRes.json();
    assert(
      midStats.resolvedIssues === initialStats.resolvedIssues,
      `resolvedIssues remains ${initialStats.resolvedIssues} when issue is in_progress`
    );

    // 6. Transition issue to resolved
    const resolvedRes = await fetch(`${BASE_URL}/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'resolved' })
    });
    assert(resolvedRes.status === 200, 'Issue transitioned to resolved');

    // 7. Verify resolvedIssues count increased by exactly 1
    const postRes = await fetch(`${BASE_URL}/stats/impact`);
    const postStats = await postRes.json();
    console.log('Post-resolved stats:', postStats);
    assert(
      postStats.resolvedIssues === initialStats.resolvedIssues + 1,
      `resolvedIssues dynamically incremented to ${postStats.resolvedIssues} (expected ${initialStats.resolvedIssues + 1})`
    );

    // 8. Revert or transition back to in_progress to confirm dynamic recalculation
    const revertRes = await fetch(`${BASE_URL}/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert(revertRes.status === 200, 'Issue transitioned back to in_progress');

    const finalRes = await fetch(`${BASE_URL}/stats/impact`);
    const finalStats = await finalRes.json();
    assert(
      finalStats.resolvedIssues === initialStats.resolvedIssues,
      `resolvedIssues decremented back to ${initialStats.resolvedIssues} when issue is no longer resolved`
    );

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
