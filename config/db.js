import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setServers is unsupported
}
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Wing from '../models/Wing.js';

let isMongoConnected = false;

export const isDatabaseConnected = () => isMongoConnected;

export const ensureCleanAuthAccounts = async () => {
  try {
    const eduWing = await Wing.findOne({ slug: 'education' });
    const healthWing = await Wing.findOne({ slug: 'health' });

    const defaultAccounts = [
      {
        name: 'WCC Administrator',
        email: 'admin@wecanchange.org',
        password: 'wccadmin2026',
        role: 'admin',
        phone: '+880 1711-000000',
        memberId: 'WCC-ADM-0001',
        status: 'active'
      },
      {
        name: 'Education Coordinator',
        email: 'coordinator.education@wecanchange.org',
        password: 'wcccoordinator2026',
        role: 'coordinator',
        assignedWing: eduWing ? eduWing._id : null,
        phone: '+880 1711-111222',
        memberId: 'WCC-COORD-0001',
        status: 'active'
      },
      {
        name: 'Health Coordinator',
        email: 'coordinator.health@wecanchange.org',
        password: 'wcccoordinator2026',
        role: 'coordinator',
        assignedWing: healthWing ? healthWing._id : null,
        phone: '+880 1711-333444',
        memberId: 'WCC-COORD-0002',
        status: 'active'
      },
      {
        name: 'Active Volunteer',
        email: 'volunteer@wecanchange.org',
        password: 'wccvolunteer2026',
        role: 'volunteer',
        phone: '+880 1711-555666',
        memberId: 'WCC-VOL-0001',
        status: 'active'
      },
      {
        name: 'Registered Member',
        email: 'member@wecanchange.org',
        password: 'wccmember2026',
        role: 'member',
        phone: '+880 1711-777888',
        memberId: 'WCC-MEM-0001',
        status: 'active'
      }
    ];

    for (const acc of defaultAccounts) {
      const existing = await User.findOne({ email: acc.email });
      if (!existing) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(acc.password, salt);
        await User.create({ ...acc, password: hashedPassword });
        console.log(`[Auth Init] Created default ${acc.role} account: ${acc.email}`);
      } else if (acc.role === 'coordinator' && acc.assignedWing && !existing.assignedWing) {
        existing.assignedWing = acc.assignedWing;
        await existing.save();
        console.log(`[Auth Init] Updated assignedWing for coordinator: ${acc.email}`);
      }
    }
  } catch (err) {
    console.error('[Auth Init Error]', err.message);
  }
};

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wcc_db';
  try {
    console.log(`[MongoDB] Attempting connection to: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    isMongoConnected = true;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);

    // Ensure clean primary test users exist
    await ensureCleanAuthAccounts();
  } catch (error) {
    isMongoConnected = false;
    console.warn(`[MongoDB] Connection notice: ${error.message}`);
    console.warn('[MongoDB] Running with in-memory resilient data store so API works immediately.');
    console.warn('[MongoDB] To connect MongoDB Atlas, set MONGO_URI in wcc_api/.env');
  }
};

export const initialWings = [
  {
    nameEn: 'Education',
    nameBn: 'শিক্ষা উইং',
    slug: 'education',
    description: 'Empowering communities through digital literacy, learning drives, and student mentorship.',
    missionPoints: ['Quality Education for All', 'Student Scholarships', 'Digital Literacy Camps'],
    coverImage: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b'
  },
  {
    nameEn: 'Health',
    nameBn: 'স্বাস্থ্য উইং',
    slug: 'health',
    description: 'Providing free health screening camps, voluntary blood donation networks, and medical aid.',
    missionPoints: ['Voluntary Blood Drives', 'Medical Health Camps', 'Hygiene & Mental Health Awareness'],
    coverImage: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7'
  },
  {
    nameEn: 'Sports',
    nameBn: 'খেলাধুলা উইং',
    slug: 'sports',
    description: 'Fostering youth development, teamwork, and healthy lifestyle through athletic tournaments.',
    missionPoints: ['Community Sports Tournaments', 'Youth Physical Fitness', 'Athletics Training Support'],
    coverImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211'
  },
  {
    nameEn: 'Culture',
    nameBn: 'সংস্কৃতি উইং',
    slug: 'culture',
    description: 'Celebrating arts, national cultural festivals, literature, and creative youth engagement.',
    missionPoints: ['Cultural Festivals & Exhibitions', 'Creative Arts Workshops', 'Youth Literary Circles'],
    coverImage: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212'
  },
  {
    nameEn: 'Heritage',
    nameBn: 'ঐতিহ্য উইং',
    slug: 'heritage',
    description: 'Preserving local history, archaeological landmarks, oral histories, and community traditions.',
    missionPoints: ['Historical Site Preservation', 'Oral History Archiving', 'Community Heritage Walks'],
    coverImage: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613'
  }
];

export const seedDatabase = async () => {
  try {
    const Wing = (await import('../models/Wing.js')).default;
    const { initialMembers } = await import('../data/seedData.js');

    console.log('[Seed] Seeding default auth accounts...');
    await ensureCleanAuthAccounts();

    console.log('[Seed] Seeding initial wings if not present...');
    for (const wing of initialWings) {
      const existing = await Wing.findOne({ slug: wing.slug });
      if (!existing) {
        await Wing.create(wing);
        console.log(`[Seed] Created wing: ${wing.nameEn} (${wing.slug})`);
      }
    }

    console.log('[Seed] Seeding initial members if not present...');
    if (Array.isArray(initialMembers)) {
      const Member = (await import('../models/Member.js')).default;
      for (const m of initialMembers.slice(0, 10)) {
        const existing = await Member.findOne({ memberId: m.memberId });
        if (!existing) {
          await Member.create(m);
        }
      }
    }
    console.log('[Seed] Database seeding completed successfully.');
  } catch (err) {
    console.error('[Seed Error]', err.message);
  }
};

