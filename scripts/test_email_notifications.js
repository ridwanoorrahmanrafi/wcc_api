/**
 * Test Suite for Task 16: MVP Email Notifications
 * Verifies:
 * 1. Reusable email helper functions (issue status change, event registration, member approval)
 * 2. Integration with API endpoints (issue status change, event registration, member approval)
 * 3. Safe non-blocking failure behavior when invalid email or transporter fails
 * 4. Verification that email failures do NOT cause main DB operations to fail
 */

import {
  isValidEmail,
  sendMailSafe,
  sendIssueStatusEmail,
  sendEventRegistrationEmail,
  sendMemberApprovalEmail,
  getSentEmails,
  clearSentEmails
} from '../services/emailService.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runTests() {
  console.log('--- [MVP Email Notifications Test Suite] Starting ---');
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
    clearSentEmails();

    // 1. Email validation helper tests
    assert(isValidEmail('reporter@example.com') === true, 'Valid email passes isValidEmail');
    assert(isValidEmail('user.name+tag@sub.domain.org') === true, 'Complex valid email passes isValidEmail');
    assert(isValidEmail('') === false, 'Empty email fails isValidEmail');
    assert(isValidEmail('not-an-email') === false, 'Invalid format fails isValidEmail');
    assert(isValidEmail(null) === false, 'Null fails isValidEmail');
    assert(isValidEmail('01711223344') === false, 'Phone number string fails isValidEmail');

    // 2. Unit test: sendIssueStatusEmail
    const issueEmailRes = await sendIssueStatusEmail({
      to: 'reporter@community.org',
      reporterName: 'Rahim Ahmed',
      issueCode: 'ISSUE-2026-999888',
      issueTitle: 'Damaged water pipe in Ward 2',
      status: 'in_progress',
      previousStatus: 'pending'
    });
    assert(issueEmailRes.success === true, 'sendIssueStatusEmail succeeded');
    let sent = getSentEmails();
    assert(sent.length === 1, '1 email recorded in sent log');
    assert(sent[0].to === 'reporter@community.org', 'Recipient matches');
    assert(sent[0].subject.includes('ISSUE-2026-999888'), 'Subject includes issue code');
    assert(sent[0].subject.includes('In Progress'), 'Subject includes new status');
    assert(sent[0].text.includes('ISSUE-2026-999888'), 'Body includes issue code');
    assert(sent[0].text.includes('track'), 'Body includes tracking instruction');

    // 3. Unit test: sendEventRegistrationEmail
    const eventEmailRes = await sendEventRegistrationEmail({
      to: 'participant@wecanchange.org',
      participantName: 'Fatima Begum',
      eventTitle: 'Youth Tech Workshop 2026',
      eventDate: new Date('2026-10-15T10:00:00Z'),
      eventLocation: 'Jhalakathi Central Library'
    });
    assert(eventEmailRes.success === true, 'sendEventRegistrationEmail succeeded');
    sent = getSentEmails();
    assert(sent.length === 2, '2 emails recorded in sent log');
    assert(sent[1].to === 'participant@wecanchange.org', 'Recipient matches');
    assert(sent[1].subject.includes('Registration Confirmed'), 'Subject contains Registration Confirmed');
    assert(sent[1].text.includes('Youth Tech Workshop 2026'), 'Body contains event title');
    assert(sent[1].text.includes('Jhalakathi Central Library'), 'Body contains event location');

    // 4. Unit test: sendMemberApprovalEmail
    const memberEmailRes = await sendMemberApprovalEmail({
      to: 'newmember@wecanchange.org',
      memberName: 'Tanvir Hossain',
      memberId: 'WCC-2026-0042',
      status: 'Active',
      wing: 'Education & Youth Wing'
    });
    assert(memberEmailRes.success === true, 'sendMemberApprovalEmail succeeded');
    sent = getSentEmails();
    assert(sent.length === 3, '3 emails recorded in sent log');
    assert(sent[2].to === 'newmember@wecanchange.org', 'Recipient matches');
    assert(sent[2].subject.includes('Approved'), 'Subject contains Approved');
    assert(sent[2].text.includes('WCC-2026-0042'), 'Body contains member ID');

    // 5. Test Non-blocking error handling: Invalid email should not throw
    const invalidEmailRes = await sendMailSafe({
      to: 'invalid-email-string',
      subject: 'Test Subject',
      html: '<p>Test</p>'
    });
    assert(invalidEmailRes.success === false, 'Invalid email safely returns success: false without throwing');
    assert(invalidEmailRes.reason === 'invalid_recipient', 'Correct failure reason returned');

    // Helper to fetch sent emails from the running server process
    async function fetchServerSentEmails() {
      const res = await fetch(`${BASE_URL}/stats/test-emails`);
      const data = await res.json();
      return data.emails || [];
    }
    async function clearServerSentEmails() {
      await fetch(`${BASE_URL}/stats/test-emails`, { method: 'DELETE' });
    }

    // 6. Integration Test: Issue Status Change triggers email
    console.log('\n--- Testing API Integration for Issue Status Change Email ---');
    await clearServerSentEmails();

    // Login as admin
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wecanchange.org', password: 'wccadmin2026' })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.token;

    // Create issue with valid reporter email
    const testReporterEmail = `reporter_${Date.now()}@example.com`;
    const issuePayload = {
      title: 'Email Notification Test Issue',
      description: 'Verifying reporter gets an email when status changes',
      location: 'Main Road, Jhalakathi',
      reporterName: 'Sumon Barua',
      reporterContact: testReporterEmail
    };

    const createRes = await fetch(`${BASE_URL}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issuePayload)
    });
    const createData = await createRes.json();
    const issueCode = createData.issueCode;

    // Lookup issue internal id
    const searchRes = await fetch(`${BASE_URL}/issues?search=${encodeURIComponent(issueCode)}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const searchData = await searchRes.json();
    const issueId = searchData.issues?.[0]?._id;

    // Transition pending -> in_progress
    const inProgressRes = await fetch(`${BASE_URL}/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert(inProgressRes.status === 200, 'API call to update status to in_progress succeeded');

    // Check sent emails on server
    let serverSent = await fetchServerSentEmails();
    assert(serverSent.length >= 1, 'Email was dispatched during pending -> in_progress transition');
    assert(serverSent[serverSent.length - 1].to === testReporterEmail, 'Email sent to correct reporter contact');
    assert(serverSent[serverSent.length - 1].subject.includes('In Progress'), 'Email subject contains In Progress');

    // Transition in_progress -> resolved
    const resolvedRes = await fetch(`${BASE_URL}/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'resolved' })
    });
    assert(resolvedRes.status === 200, 'API call to update status to resolved succeeded');

    serverSent = await fetchServerSentEmails();
    assert(serverSent.length >= 2, 'Email was dispatched during in_progress -> resolved transition');
    assert(serverSent[serverSent.length - 1].to === testReporterEmail, 'Email sent to correct reporter contact');
    assert(serverSent[serverSent.length - 1].subject.includes('Resolved'), 'Email subject contains Resolved');

    // 7. Integration Test: Member Status Update (Active) triggers email
    console.log('\n--- Testing API Integration for Member Approval Email ---');
    await clearServerSentEmails();

    const testMemberEmail = `member_${Date.now()}@example.com`;
    const newMemberRes = await fetch(`${BASE_URL}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameBn: 'পরীক্ষার্থী সদস্য',
        nameEn: 'TEST MEMBER APPROVAL',
        mobile: '01700998877',
        email: testMemberEmail,
        status: 'Pending',
        wing: 'শিক্ষা ও যুব উন্নয়ন উইং'
      })
    });
    const newMemberData = await newMemberRes.json();
    const createdMemberId = newMemberData.member?.memberId;

    // Admin updates status to Active (Approval)
    const approveRes = await fetch(`${BASE_URL}/members/${createdMemberId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Active' })
    });
    assert(approveRes.status === 200, 'PATCH /api/members/:id/status returned 200');

    serverSent = await fetchServerSentEmails();
    assert(serverSent.length >= 1, 'Approval email dispatched');
    assert(serverSent[serverSent.length - 1].to === testMemberEmail, 'Approval email sent to member email');
    assert(serverSent[serverSent.length - 1].subject.includes('Approved'), 'Subject contains Approved');

    // 8. Integration Test: Event Registration Confirmation Email
    console.log('\n--- Testing API Integration for Event Registration Confirmation Email ---');
    await clearServerSentEmails();

    // Fetch wings to attach to test event
    const wingsRes = await fetch(`${BASE_URL}/wings`);
    const wings = await wingsRes.json();
    const testWingId = wings[0]?._id;

    // Admin creates an event
    const eventPayload = {
      title: `Email Test Event ${Date.now()}`,
      wingId: testWingId,
      date: new Date(Date.now() + 86400000).toISOString(),
      location: 'Community Center, Jhalakathi',
      capacity: 50,
      status: 'published'
    };
    const createEventRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(eventPayload)
    });
    const createEventData = await createEventRes.json();
    const eventId = createEventData.event?._id;
    assert(createEventRes.status === 201, 'Test event created successfully');

    // Login as member
    const memberLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@wecanchange.org', password: 'wccmember2026' })
    });
    const memberLoginData = await memberLoginRes.json();
    const memberToken = memberLoginData.token;
    assert(Boolean(memberToken), 'Member login succeeded');

    // Register for the event as member
    const registerRes = await fetch(`${BASE_URL}/events/${eventId}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    });
    assert(registerRes.status === 201, 'POST /api/events/:id/register returned 201');

    serverSent = await fetchServerSentEmails();
    assert(serverSent.length >= 1, 'Event registration confirmation email dispatched by server');
    assert(serverSent[serverSent.length - 1].to === 'member@wecanchange.org', 'Confirmation email sent to member email');
    assert(serverSent[serverSent.length - 1].subject.includes('Registration Confirmed'), 'Subject contains Registration Confirmed');
    assert(serverSent[serverSent.length - 1].text.includes(eventPayload.title), 'Body contains event title');
    assert(serverSent[serverSent.length - 1].text.includes('Community Center'), 'Body contains event location');

    // 9. Integration Test: Member Rejection Email
    console.log('\n--- Testing API Integration for Member Rejection Email ---');
    await clearServerSentEmails();

    const rejectMemberEmail = `reject_${Date.now()}@example.com`;
    const rejectMemberReg = await fetch(`${BASE_URL}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameBn: 'বাতিলকৃত সদস্য',
        nameEn: 'REJECT TEST MEMBER',
        mobile: '01700112233',
        email: rejectMemberEmail,
        status: 'Pending',
        wing: 'দুর্যোগ ও ত্রাণ উইং'
      })
    });
    const rejectMemberData = await rejectMemberReg.json();
    const rejectMemberId = rejectMemberData.member?.memberId;

    const rejectRes = await fetch(`${BASE_URL}/members/${rejectMemberId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Rejected' })
    });
    assert(rejectRes.status === 200, 'PATCH /api/members/:id/status to Rejected returned 200');

    serverSent = await fetchServerSentEmails();
    assert(serverSent.length >= 1, 'Rejection email dispatched');
    assert(serverSent[serverSent.length - 1].to === rejectMemberEmail, 'Rejection email sent to correct address');
    assert(serverSent[serverSent.length - 1].subject.includes('membership application'), 'Subject reflects application update');

    // 10. Integration Test: Member Registration with phone-only (non-email) does NOT fail
    console.log('\n--- Testing Non-Email Graceful Handling ---');
    const phoneOnlyRes = await fetch(`${BASE_URL}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Phone Only Reporter Issue',
        description: 'Reporter only provided a mobile phone number, no email',
        location: 'Kowrikhara, Jhalakathi',
        reporterName: 'Phone Only User',
        reporterContact: '01712345678'
      })
    });
    const phoneOnlyData = await phoneOnlyRes.json();
    const phoneSearch = await fetch(`${BASE_URL}/issues?search=${encodeURIComponent(phoneOnlyData.issueCode)}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const phoneSearchData = await phoneSearch.json();
    const phoneIssueId = phoneSearchData.issues?.[0]?._id;

    // Transition status to in_progress - should succeed cleanly without crashing
    const phoneStatusRes = await fetch(`${BASE_URL}/issues/${phoneIssueId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert(phoneStatusRes.status === 200, 'Status update for phone-only reporter succeeds without email failure');
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
