import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper to check if requester is Admin or Education Wing Leader
const canManageEducationWing = async (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const educationWing = await Store.getWingBySlug('education');
  if (!educationWing) return false;

  const leaderId = educationWing.leader?._id || educationWing.leader;
  const userId = String(user.id || user._id);

  if (leaderId && String(leaderId) === userId) return true;
  if (user.assignedWing && String(user.assignedWing) === String(educationWing._id)) return true;
  if (user.role === 'wing_leader' || user.role === 'coordinator') {
    if (user.volunteerWing && user.volunteerWing.toLowerCase().includes('শিক্ষা')) return true;
    if (user.volunteerWing && user.volunteerWing.toLowerCase().includes('education')) return true;
  }

  return false;
};

// ============================================================================
// 1. FREE COURSES (WCC Education Wing)
// ============================================================================

// List published courses (Public & Members)
router.get('/courses', optionalAuth, async (req, res, next) => {
  try {
    const { category, status } = req.query;
    // Only leaders/admins can see draft courses
    const isLeader = await canManageEducationWing(req.user);
    const filterStatus = isLeader ? (status || 'all') : 'published';

    const courses = await Store.getCourses({ category, status: filterStatus });
    res.json(courses);
  } catch (err) {
    next(err);
  }
});

// Get single course details
router.get('/courses/:id', optionalAuth, async (req, res, next) => {
  try {
    const course = await Store.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const userId = req.user ? String(req.user.id || req.user._id) : null;
    const isEnrolled = userId
      ? (course.enrolledMembers || []).some(m => String(m._id || m) === userId)
      : false;

    const isLeader = await canManageEducationWing(req.user);

    // If user is not authenticated or not enrolled, hide full video embed links to non-members if wanted,
    // but allow registered members to access freely!
    const responseData = {
      ...course.toObject ? course.toObject() : course,
      isEnrolled,
      canEdit: isLeader
    };

    res.json(responseData);
  } catch (err) {
    next(err);
  }
});

// Enroll in a free course (Any verified member)
router.post('/courses/:id/enroll', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const result = await Store.enrollCourse(req.params.id, userId);
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: 'COURSE_ENROLL',
      module: 'EducationWing',
      recordId: req.params.id,
      details: `Enrolled in free course: ${result.course?.title || req.params.id}`
    });

    res.json({
      message: result.alreadyEnrolled
        ? 'Already enrolled in this course.'
        : 'Successfully enrolled in course for free!',
      alreadyEnrolled: result.alreadyEnrolled
    });
  } catch (err) {
    next(err);
  }
});

// Create a new free course (Admin or Education Wing Leader)
router.post('/courses', verifyToken, async (req, res, next) => {
  try {
    const isLeader = await canManageEducationWing(req.user);
    if (!isLeader) {
      return res.status(403).json({ error: 'Access denied. Only Admin or Education Wing Leader can launch courses.' });
    }

    const {
      title,
      description,
      category,
      level,
      duration,
      thumbnail,
      instructor,
      lessons,
      status
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const educationWing = await Store.getWingBySlug('education');
    if (!educationWing) {
      return res.status(404).json({ error: 'Education wing not found in system' });
    }

    // Generate unique slug
    const cleanSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `course-${Date.now()}`;
    const uniqueSlug = `${cleanSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCourse = await Store.createCourse({
      title: title.trim(),
      slug: uniqueSlug,
      description: description.trim(),
      wing: educationWing._id,
      wingSlug: 'education',
      category: category || 'General',
      level: level || 'Beginner',
      duration: duration || 'Self-paced',
      thumbnail: thumbnail || '',
      instructor: instructor || { name: req.user.name || 'WCC Instructor' },
      lessons: Array.isArray(lessons) ? lessons : [],
      status: status || 'published',
      createdBy: req.user.id || req.user._id
    });

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: 'CREATE_COURSE',
      module: 'EducationWing',
      recordId: String(newCourse._id),
      details: `Launched new free course: "${newCourse.title}"`
    });

    res.status(201).json({
      message: 'Free course launched successfully',
      course: newCourse
    });
  } catch (err) {
    next(err);
  }
});

// Update course (Admin or Education Wing Leader)
router.put('/courses/:id', verifyToken, async (req, res, next) => {
  try {
    const isLeader = await canManageEducationWing(req.user);
    if (!isLeader) {
      return res.status(403).json({ error: 'Access denied. Only Admin or Education Wing Leader can update courses.' });
    }

    const updated = await Store.updateCourse(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      message: 'Course updated successfully',
      course: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete course (Admin or Education Wing Leader)
router.delete('/courses/:id', verifyToken, async (req, res, next) => {
  try {
    const isLeader = await canManageEducationWing(req.user);
    if (!isLeader) {
      return res.status(403).json({ error: 'Access denied. Only Admin or Education Wing Leader can delete courses.' });
    }

    const deleted = await Store.deleteCourse(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. BOOK DONATIONS
// ============================================================================

// List books (Approved for public/members; All/Pending for Admin & Wing Leader)
router.get('/books', optionalAuth, async (req, res, next) => {
  try {
    const { category, search, status } = req.query;
    const isLeader = await canManageEducationWing(req.user);

    // Regular users can only see approved books; leaders can pass status filter
    const targetStatus = isLeader ? (status || 'approved') : 'approved';

    const books = await Store.getBooks({ status: targetStatus, category, search });
    res.json(books);
  } catch (err) {
    next(err);
  }
});

// Get user's own donated books
router.get('/books/my-donations', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const myBooks = await Store.getMyBookDonations(userId);
    res.json(myBooks);
  } catch (err) {
    next(err);
  }
});

// Get single book details
router.get('/books/:id', optionalAuth, async (req, res, next) => {
  try {
    const book = await Store.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (err) {
    next(err);
  }
});

// Member submits a book donation (status starts as 'pending')
router.post('/books', verifyToken, async (req, res, next) => {
  try {
    const {
      title,
      author,
      edition,
      category,
      condition,
      language,
      description,
      coverImage,
      pickupLocation,
      phone
    } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'Title and Author are required for book donation' });
    }

    const user = await Store.getUserById(req.user.id || req.user._id);

    const newBook = await Store.createBook({
      title: title.trim(),
      author: author.trim(),
      edition: edition || '',
      category: category || 'Academic',
      condition: condition || 'Good',
      language: language || 'বাংলা',
      description: description || '',
      coverImage: coverImage || '',
      pickupLocation: pickupLocation || 'ঝালকাঠি সদর',
      donor: {
        userId: req.user.id || req.user._id,
        name: user?.name || req.user.name || 'Anonymous Donor',
        phone: phone || user?.phone || '',
        email: user?.email || req.user.email || ''
      },
      status: 'pending'
    });

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: 'BOOK_DONATE_SUBMIT',
      module: 'EducationWing',
      recordId: String(newBook._id),
      details: `Submitted book donation: "${newBook.title}" by ${newBook.author} (Pending approval)`
    });

    res.status(201).json({
      message: 'Book donation submitted successfully! Pending Education Wing Leader review.',
      book: newBook
    });
  } catch (err) {
    next(err);
  }
});

// Approve or Reject a book donation (Admin or Education Wing Leader)
router.patch('/books/:id/status', verifyToken, async (req, res, next) => {
  try {
    const isLeader = await canManageEducationWing(req.user);
    if (!isLeader) {
      return res.status(403).json({ error: 'Access denied. Only Admin or Education Wing Leader can review book donations.' });
    }

    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected', 'donated'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved, rejected, or donated' });
    }

    const updated = await Store.updateBookStatus(req.params.id, {
      status,
      rejectionReason: rejectionReason || '',
      approvedBy: req.user.id || req.user._id
    });

    if (!updated) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: `BOOK_DONATION_${status.toUpperCase()}`,
      module: 'EducationWing',
      recordId: String(updated._id),
      details: `Book donation "${updated.title}" marked as ${status}${rejectionReason ? ` (Reason: ${rejectionReason})` : ''}`
    });

    res.json({
      message: `Book donation successfully ${status}!`,
      book: updated
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. BOOK REQUESTS
// ============================================================================

// Member requests a book
router.post('/books/:id/request', verifyToken, async (req, res, next) => {
  try {
    const { reason, deliveryAddress, contactPhone } = req.body;

    if (!reason || !deliveryAddress || !contactPhone) {
      return res.status(400).json({ error: 'Reason, delivery address, and contact phone are required' });
    }

    const book = await Store.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.status !== 'approved') {
      return res.status(400).json({ error: 'This book is not currently available for request' });
    }

    const user = await Store.getUserById(req.user.id || req.user._id);

    const requestDoc = await Store.createBookRequest({
      book: book._id,
      requester: {
        userId: req.user.id || req.user._id,
        name: user?.name || req.user.name,
        phone: contactPhone,
        email: user?.email || req.user.email,
        memberId: user?.memberId || ''
      },
      reason: reason.trim(),
      deliveryAddress: deliveryAddress.trim(),
      contactPhone: contactPhone.trim(),
      status: 'pending'
    });

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: 'BOOK_REQUEST_SUBMIT',
      module: 'EducationWing',
      recordId: String(requestDoc._id),
      details: `Requested book: "${book.title}" for educational purpose`
    });

    res.status(201).json({
      message: 'Book request submitted successfully! Pending Education Wing Leader review.',
      bookRequest: requestDoc
    });
  } catch (err) {
    next(err);
  }
});

// Member views their own book requests
router.get('/book-requests/my-requests', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const myRequests = await Store.getMyBookRequests(userId);
    res.json(myRequests);
  } catch (err) {
    next(err);
  }
});

// Admin / Wing Leader views all book requests
router.get('/book-requests', verifyToken, async (req, res, next) => {
  try {
    const isLeader = await canManageEducationWing(req.user);
    if (!isLeader) {
      return res.status(403).json({ error: 'Access denied. Only Admin or Education Wing Leader can view all requests.' });
    }

    const { status } = req.query;
    const requests = await Store.getBookRequests({ status });
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

// Approve or Reject a book request (Admin or Education Wing Leader)
router.patch('/book-requests/:id/status', verifyToken, async (req, res, next) => {
  try {
    const isLeader = await canManageEducationWing(req.user);
    if (!isLeader) {
      return res.status(403).json({ error: 'Access denied. Only Admin or Education Wing Leader can review book requests.' });
    }

    const { status, rejectionReason, adminNotes } = req.body;
    if (!['approved', 'rejected', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved, rejected, completed, or cancelled' });
    }

    const updated = await Store.updateBookRequestStatus(req.params.id, {
      status,
      rejectionReason: rejectionReason || '',
      adminNotes: adminNotes || '',
      reviewedBy: req.user.id || req.user._id
    });

    if (!updated) {
      return res.status(404).json({ error: 'Book request not found' });
    }

    // If request is approved, we can also mark the book as requested/donated
    if (status === 'approved' && updated.book) {
      const bookId = updated.book._id || updated.book;
      await Store.updateBookStatus(bookId, { status: 'requested' });
    }

    await Store.addAuditLog({
      user: req.user.name || req.user.email,
      role: req.user.role,
      action: `BOOK_REQUEST_${status.toUpperCase()}`,
      module: 'EducationWing',
      recordId: String(updated._id),
      details: `Book request for "${updated.book?.title || 'Book'}" was ${status}${rejectionReason ? ` (Reason: ${rejectionReason})` : ''}`
    });

    res.json({
      message: `Book request ${status} successfully!`,
      bookRequest: updated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
