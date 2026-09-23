import express from 'express';
import { Store } from '../data/store.js';
import { verifyToken, requireAdminOrCoordinator, optionalAuth } from '../middleware/auth.js';
import { sendEventRegistrationEmail, isValidEmail } from '../services/emailService.js';
import { publicSubmitLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();
const ALLOWED_STATUSES = ['draft', 'published', 'completed', 'cancelled'];

// List events with optional filters (Public users get published events; Admins and Coordinators can manage)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { wingId, programId, status } = req.query;
    const isAdmin = Boolean(req.user?.isAdmin);
    const isCoordinator = Boolean(req.user?.isCoordinator);
    const assignedWing = req.user?.assignedWing || null;

    // Coordinators can view unpublished events for their assigned wing
    const isCoordinatorWing = isCoordinator && assignedWing && (!wingId || String(wingId) === assignedWing);
    const isPublic = !isAdmin && !isCoordinatorWing;

    const events = await Store.getEvents({
      wingId: isCoordinatorWing && !wingId ? assignedWing : wingId,
      programId,
      status,
      isPublic
    });

    res.json(events);
  } catch (err) {
    next(err);
  }
});

// Get single event by ID (Public)
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const event = await Store.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // If unauthenticated guest and event is draft/cancelled, restrict unless admin or assigned coordinator
    const isAdmin = Boolean(req.user?.isAdmin);
    const isCoordinator = Boolean(req.user?.isCoordinator);
    const assignedWing = req.user?.assignedWing || null;
    const isAssignedCoordinator = isCoordinator && assignedWing && String(event.wingId?._id || event.wingId) === assignedWing;
    if (!isAdmin && !isAssignedCoordinator && event.status !== 'published') {
      return res.status(404).json({ error: 'Event not found' });
    }

    const registeredCount = await Store.getEventRegistrationCount(req.params.id);
    const eventObj = event.toObject ? event.toObject() : { ...event };
    eventObj.registeredCount = registeredCount;
    eventObj.isFull = Boolean(event.capacity && event.capacity > 0 && registeredCount >= event.capacity);

    res.json(eventObj);
  } catch (err) {
    next(err);
  }
});

// Create new event (Admin & Coordinator for their wing)
router.post('/', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { title, wingId, programId, date, location, capacity, description, coverImage, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!wingId) {
      return res.status(400).json({ error: 'wingId is required' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      if (!coordWingId || coordWingId !== String(wingId)) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only create events for their assigned wing.'
        });
      }
    }

    if (!date) {
      return res.status(400).json({ error: 'Event date is required' });
    }

    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Location is required' });
    }

    // Validate wingId
    const wing = await Store.getWingById(wingId);
    if (!wing) {
      return res.status(400).json({ error: 'Referenced Wing does not exist' });
    }

    // Validate programId if provided
    let cleanProgramId = null;
    if (programId) {
      const prog = await Store.getProgramById(programId);
      if (!prog) {
        return res.status(400).json({ error: 'Referenced Program does not exist' });
      }
      cleanProgramId = programId;
    }

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid event date format' });
    }

    // Validate capacity if provided
    let parsedCapacity = null;
    if (capacity !== undefined && capacity !== null && capacity !== '') {
      parsedCapacity = Number(capacity);
      if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
        return res.status(400).json({ error: 'Capacity must be a positive number' });
      }
    }

    // Validate status if provided
    let eventStatus = 'draft';
    if (status) {
      const cleanStatus = status.toLowerCase().trim();
      if (!ALLOWED_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
        });
      }
      eventStatus = cleanStatus;
    }

    const newEvent = await Store.createEvent({
      title: title.trim(),
      wingId,
      programId: cleanProgramId,
      date: parsedDate,
      location: location.trim(),
      capacity: parsedCapacity,
      description: description || '',
      coverImage: coverImage || '',
      status: eventStatus,
      createdBy: typeof req.user?.id === 'string' && /^[0-9a-fA-F]{24}$/.test(req.user.id) ? req.user.id : null
    });

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'CREATE_EVENT',
      module: 'Events',
      recordId: String(newEvent._id),
      details: `Created event: ${newEvent.title} under ${wing.nameEn}`
    });

    res.status(201).json({
      message: 'Event created successfully',
      event: newEvent
    });
  } catch (err) {
    next(err);
  }
});

// Update event by ID (Admin & Coordinator for their wing)
router.put('/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const existing = await Store.getEventById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const existingWingId = String(existing.wingId?._id || existing.wingId || '');
      if (!coordWingId || existingWingId !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only manage events belonging to their assigned wing.'
        });
      }
      if (req.body.wingId !== undefined && String(req.body.wingId) !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators cannot reassign events to another wing.'
        });
      }
    }

    const { title, wingId, programId, date, location, capacity, description, coverImage, status } = req.body;
    const updateData = {};

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
      updateData.title = title.trim();
    }

    if (wingId !== undefined) {
      const wing = await Store.getWingById(wingId);
      if (!wing) return res.status(400).json({ error: 'Referenced Wing does not exist' });
      updateData.wingId = wingId;
    }

    if (programId !== undefined) {
      if (programId) {
        const prog = await Store.getProgramById(programId);
        if (!prog) return res.status(400).json({ error: 'Referenced Program does not exist' });
        updateData.programId = programId;
      } else {
        updateData.programId = null;
      }
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid event date format' });
      updateData.date = parsedDate;
    }

    if (location !== undefined) {
      if (!location.trim()) return res.status(400).json({ error: 'Location cannot be empty' });
      updateData.location = location.trim();
    }

    if (capacity !== undefined) {
      if (capacity === null || capacity === '') {
        updateData.capacity = null;
      } else {
        const parsedCapacity = Number(capacity);
        if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
          return res.status(400).json({ error: 'Capacity must be a positive number' });
        }
        updateData.capacity = parsedCapacity;
      }
    }

    if (description !== undefined) updateData.description = description;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    if (status !== undefined) {
      const cleanStatus = status.toLowerCase().trim();
      if (!ALLOWED_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
        });
      }
      updateData.status = cleanStatus;
    }

    const updated = await Store.updateEvent(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'UPDATE_EVENT',
      module: 'Events',
      recordId: String(updated._id),
      details: `Updated event: ${updated.title}`
    });

    res.json({
      message: 'Event updated successfully',
      event: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete event by ID (Admin & Coordinator for their wing)
router.delete('/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const existing = await Store.getEventById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const existingWingId = String(existing.wingId?._id || existing.wingId || '');
      if (!coordWingId || existingWingId !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only delete events belonging to their assigned wing.'
        });
      }
    }

    const deleted = await Store.deleteEvent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'DELETE_EVENT',
      module: 'Events',
      recordId: String(deleted._id),
      details: `Deleted event: ${deleted.title}`
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Check if current user is registered for an event
router.get('/:id/my-registration', verifyToken, async (req, res, next) => {
  try {
    const registration = await Store.getEventRegistration(req.params.id, req.user.id);
    res.json({
      registered: Boolean(registration),
      registration: registration || null
    });
  } catch (err) {
    next(err);
  }
});

// Register current user for an event (Authenticated Member/Volunteer/User)
router.post('/:id/register', publicSubmitLimiter, verifyToken, async (req, res, next) => {
  try {
    const event = await Store.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Reject registration for cancelled events
    if (event.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot register for a cancelled event' });
    }

    // Reject registration for draft or completed events
    if (event.status === 'draft') {
      return res.status(400).json({ error: 'Cannot register for a draft event' });
    }

    if (event.status === 'completed') {
      return res.status(400).json({ error: 'Cannot register for an event that has already ended' });
    }

    // Prevent duplicate registration
    const existing = await Store.getEventRegistration(req.params.id, req.user.id);
    if (existing) {
      return res.status(400).json({
        error: 'You are already registered for this event',
        registration: existing
      });
    }

    // Reject if event capacity has been reached
    if (event.capacity && event.capacity > 0) {
      const currentCount = await Store.getEventRegistrationCount(req.params.id);
      if (currentCount >= event.capacity) {
        return res.status(400).json({
          error: `Registration is full. Event capacity (${event.capacity} attendees) has been reached.`
        });
      }
    }

    const registration = await Store.createEventRegistration({
      eventId: event._id,
      userId: req.user.id
    });

    // Audit log
    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'User',
      role: req.user?.role || 'member',
      action: 'REGISTER_EVENT',
      module: 'Events',
      recordId: String(event._id),
      details: `User ${req.user?.name || req.user?.email} (${req.user?.role}) registered for event "${event.title}"`
    });

    // Send transactional confirmation email if user has a valid email address
    const recipientEmail = req.user?.email;
    if (recipientEmail && isValidEmail(recipientEmail)) {
      try {
        await sendEventRegistrationEmail({
          to: recipientEmail,
          participantName: req.user?.name || 'Valued Member',
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location
        });
      } catch (err) {
        console.error('[EmailService Error] Failed to send event registration confirmation email:', err.message);
      }
    }

    res.status(201).json({
      message: 'Successfully registered for event',
      registration
    });
  } catch (err) {
    next(err);
  }
});

// View all registrations for an event (Admin & Coordinator for their wing)
router.get('/:id/registrations', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const event = await Store.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Coordinator wing scoping check
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const eventWingId = String(event.wingId?._id || event.wingId || '');
      if (!coordWingId || eventWingId !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only view registrations for events in their assigned wing.'
        });
      }
    }

    const registrations = await Store.getEventRegistrations(req.params.id);
    res.json({
      total: registrations.length,
      capacity: event.capacity || null,
      registrations
    });
  } catch (err) {
    next(err);
  }
});

// Update participant attendance (Admin & Coordinator for their wing)
router.patch('/:id/attendance', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const event = await Store.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Enforce Coordinator wing-scoping
    if (req.user.role === 'coordinator') {
      const coordWingId = String(req.user.assignedWing?._id || req.user.assignedWing || '');
      const eventWingId = String(event.wingId?._id || event.wingId || '');
      if (!coordWingId || eventWingId !== coordWingId) {
        return res.status(403).json({
          error: 'Forbidden: Coordinators can only modify attendance for events in their assigned wing.'
        });
      }
    }

    // Normalize attendees input (accepts { attendees: [...] } or single { userId/registrationId, attended })
    let attendeesList = [];
    if (Array.isArray(req.body.attendees)) {
      attendeesList = req.body.attendees;
    } else if (req.body.userId || req.body.registrationId || req.body._id) {
      attendeesList = [req.body];
    } else {
      return res.status(400).json({ error: 'Attendance payload with attendees array or participant details is required' });
    }

    // Verify all participants are actually registered for this event
    const currentRegs = await Store.getEventRegistrations(req.params.id);
    const validRegIds = new Set(currentRegs.map(r => String(r._id)));
    const validUserIds = new Set(
      currentRegs.map(r => {
        const raw = r._doc || r;
        return String(r.userId?._id || raw.userId || raw.memberId || r.userId || '');
      }).filter(Boolean)
    );

    const validUpdates = [];
    for (const item of attendeesList) {
      const regId = String(item.registrationId || item._id || '');
      const uId = String(item.userId || '');

      const isRegistered = (regId && validRegIds.has(regId)) || (uId && validUserIds.has(uId));
      if (!isRegistered) {
        return res.status(400).json({
          error: 'Cannot record attendance: Participant is not registered for this event.'
        });
      }

      validUpdates.push({
        registrationId: regId || undefined,
        userId: uId || undefined,
        attended: Boolean(item.attended)
      });
    }

    // Save attendance updates
    const updatedRegistrations = await Store.updateEventAttendance(req.params.id, validUpdates);

    // AuditLog entry
    await Store.addAuditLog({
      user: req.user?.name || req.user?.email || 'Admin',
      role: req.user?.role || 'admin',
      action: 'UPDATE_EVENT_ATTENDANCE',
      module: 'Events',
      recordId: String(event._id),
      details: `Updated attendance for ${validUpdates.length} participant(s) in event "${event.title}"`
    });

    res.json({
      message: 'Attendance updated successfully',
      updatedCount: validUpdates.length,
      registrations: updatedRegistrations
    });
  } catch (err) {
    next(err);
  }
});

export default router;
