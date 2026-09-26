import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Wing from '../models/Wing.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Book from '../models/Book.js';
import BookRequest from '../models/BookRequest.js';

export const syncWingsAndEducation = async () => {
  console.log('[Sync] Connecting to database...');
  await connectDB();

  // 1. Ensure 5 Wings exist exactly as requested:
  // 1. education, 2. health, 3. sports, 4. cultural, 5. environment
  const targetWings = [
    {
      nameEn: 'Education',
      nameBn: 'শিক্ষা উইং',
      slug: 'education',
      description: 'মেধাবী ও অসচ্ছল শিক্ষার্থীদের শিক্ষাবৃত্তি, বিনামূল্যে স্কিল ডেভেলপমেন্ট কোর্স, বই অনুদান ও ক্যারিয়ার মেন্টরশিপ।',
      missionPoints: [
        'Free Skill Courses for Members',
        'Book Donation & Exchange Library',
        'Student Mentorship & Scholarships'
      ],
      coverImage: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Health',
      nameBn: 'স্বাস্থ্য উইং',
      slug: 'health',
      description: 'বিনামূল্যে স্বাস্থ্য ও চক্ষু ক্যাম্প, স্বেচ্ছায় রক্তদান নেটওয়ার্ক এবং জরুরি টেলিমেডিসিন সেবা।',
      missionPoints: [
        'Voluntary Blood Drives',
        'Medical Health Camps',
        'Hygiene & Mental Health Awareness'
      ],
      coverImage: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Sports',
      nameBn: 'খেলাধুলা উইং',
      slug: 'sports',
      description: 'মাদক ও ডিজিটাল আসক্তি মুক্ত সমাজ গঠনে তৃণমূল ফুটবল, ক্রিকেট ও যুব অ্যাথলেটিক্স প্রতিযোগিতা।',
      missionPoints: [
        'Community Sports Tournaments',
        'Youth Physical Fitness',
        'Athletics Training Support'
      ],
      coverImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Cultural',
      nameBn: 'সংস্কৃতি উইং',
      slug: 'cultural',
      description: 'বাঙালি সংস্কৃতি, ভাষা আন্দোলন ও মুক্তিযুদ্ধের সঠিক ইতিহাস চর্চা, সাহিত্য সম্মেলন ও সৃজনশীল নাট্যকর্ম।',
      missionPoints: [
        'Cultural Festivals & Exhibitions',
        'Creative Arts Workshops',
        'Youth Literary Circles'
      ],
      coverImage: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&q=80&w=800'
    },
    {
      nameEn: 'Environment',
      nameBn: 'পরিবেশ উইং',
      slug: 'environment',
      description: 'সুগন্ধা নদী রক্ষা, ব্যাপক বৃক্ষরোপণ, বর্জ্য নিষ্কাশন ও প্লাস্টিক দূষণ রোধে তরুণদের পরিবেশ আন্দোলন।',
      missionPoints: [
        'Tree Plantation Campaigns',
        'River Cleanliness & Conservation',
        'Plastic Pollution Awareness & Recycling'
      ],
      coverImage: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800'
    }
  ];

  // If old 'heritage' wing exists, update it to 'environment'
  const heritageWing = await Wing.findOne({ slug: 'heritage' });
  if (heritageWing) {
    console.log('[Sync] Migrating existing "heritage" wing to "environment"...');
    await Wing.findByIdAndUpdate(heritageWing._id, {
      nameEn: 'Environment',
      nameBn: 'পরিবেশ উইং',
      slug: 'environment',
      description: 'সুগন্ধা নদী রক্ষা, ব্যাপক বৃক্ষরোপণ, বর্জ্য নিষ্কাশন ও প্লাস্টিক দূষণ রোধে তরুণদের পরিবেশ আন্দোলন।',
      missionPoints: [
        'Tree Plantation Campaigns',
        'River Cleanliness & Conservation',
        'Plastic Pollution Awareness & Recycling'
      ],
      coverImage: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800'
    });
  }

  // If old 'culture' wing exists, update to 'cultural'
  const cultureWing = await Wing.findOne({ slug: 'culture' });
  if (cultureWing) {
    console.log('[Sync] Migrating existing "culture" wing to "cultural"...');
    await Wing.findByIdAndUpdate(cultureWing._id, {
      nameEn: 'Cultural',
      slug: 'cultural'
    });
  }

  // Upsert all 5 target wings
  const wingMap = {};
  for (const tw of targetWings) {
    const doc = await Wing.findOneAndUpdate(
      { slug: tw.slug },
      { $set: tw },
      { upsert: true, new: true }
    );
    wingMap[tw.slug] = doc;
    console.log(`✓ Wing verified: ${doc.nameEn} (${doc.slug}) [ID: ${doc._id}]`);
  }

  // Find an admin user to be default assigner / creator
  const adminUser = await User.findOne({ role: 'admin' });
  const sampleMember = await User.findOne({ role: 'member' }) || adminUser;

  // Assign a sample Wing Leader for Education Wing if none assigned
  const eduWing = wingMap['education'];
  if (eduWing && !eduWing.leader) {
    // Check if we have a user to assign as wing leader
    let leaderCandidate = await User.findOne({ email: 'tanvir.chowdhury@example.com' });
    if (!leaderCandidate) {
      leaderCandidate = await User.findOne({ role: { $in: ['coordinator', 'member'] } });
    }

    if (leaderCandidate) {
      leaderCandidate.role = 'wing_leader';
      leaderCandidate.assignedWing = eduWing._id;
      leaderCandidate.volunteerWing = `${eduWing.nameBn} (${eduWing.nameEn})`;
      await leaderCandidate.save();

      eduWing.leader = leaderCandidate._id;
      await eduWing.save();
      console.log(`✓ Assigned Education Wing Leader: ${leaderCandidate.name} (${leaderCandidate.email})`);
    }
  }

  // 2. Seed Free Courses for Education Wing if none exist
  const existingCourses = await Course.countDocuments({ wing: eduWing._id });
  if (existingCourses === 0) {
    console.log('[Sync] Seeding initial free courses for Education Wing...');
    const coursesToSeed = [
      {
        title: 'ফ্রি ওয়েব ডেভেলপমেন্ট ও ফ্রন্টএন্ড মাস্টারি (HTML, CSS, JS)',
        slug: 'web-development-frontend-mastery',
        description: 'ঝালকাঠি ও সারাদেশের শিক্ষার্থীদের জন্য WCC শিক্ষা উইংয়ের বিশেষায়িত ফ্রি ওয়েব ডেভেলপমেন্ট কোর্স। কোনো পূর্ব অভিজ্ঞতা ছাড়াই প্রফেশনাল ফ্রন্টএন্ড কোডিং শিখুন।',
        wing: eduWing._id,
        wingSlug: 'education',
        category: 'Web Development',
        level: 'Beginner',
        duration: '৬ সপ্তাহ (১২টি লেকচার)',
        thumbnail: 'https://images.unsplash.com/photo-1593720213428-28a5b9e94613?auto=format&fit=crop&q=80&w=800',
        instructor: {
          name: 'তানভীর আহমেদ চৌধুরী',
          title: 'সফটওয়্যার ইঞ্জিনিয়ার ও শিক্ষা উইং লিডার',
          organization: 'উই ক্যান চেঞ্জ (WCC)',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
        },
        lessons: [
          {
            title: 'মডিউল ১: ওয়েব পরিচিতি ও HTML5 ফাউন্ডেশন',
            description: 'ইন্টারনেট কীভাবে কাজ করে এবং ওয়েবসাইট তৈরির মূল কাঠামো HTML5 এর ব্যবহারিক ধারণা।',
            videoUrl: 'https://www.youtube.com/embed/pQN-pnXPaVg',
            duration: '৪৫ মিনিট',
            order: 1
          },
          {
            title: 'মডিউল ২: আধুনিক CSS3 ও রেসপন্সিভ লেআউট',
            description: 'Flexbox, Grid এবং আধুনিক ওয়েবসাইট ডিজাইন টেকনিক।',
            videoUrl: 'https://www.youtube.com/embed/1Rs2ND1ryYc',
            duration: '৫৫ মিনিট',
            order: 2
          },
          {
            title: 'মডিউল ৩: JavaScript এর প্রাথমিক প্রোগ্রামিং লজিক',
            description: 'Variables, Functions, Arrays, Objects ও DOM ম্যানিপুলেশন।',
            videoUrl: 'https://www.youtube.com/embed/W6NZfCO5SIk',
            duration: '৬০ মিনিট',
            order: 3
          }
        ],
        status: 'published',
        createdBy: adminUser?._id
      },
      {
        title: 'স্পোকেন ইংলিশ অ্যান্ড প্রফেশনাল কমিউনিকেশন স্কিলস',
        slug: 'spoken-english-professional-communication',
        description: 'দৈনন্দিন কথোপকথন, ইন্টারভিউ ও উচ্চশিক্ষার জন্য স্পষ্ট ও আত্মবিশ্বাসী ইংরেজি বলার কৌশল। সকল WCC মেম্বারদের জন্য শতভাগ ফ্রি।',
        wing: eduWing._id,
        wingSlug: 'education',
        category: 'Language & Communication',
        level: 'All Levels',
        duration: '৪ সপ্তাহ',
        thumbnail: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=800',
        instructor: {
          name: 'নুসরাত জাহান মীম',
          title: 'ভাষা ও যোগাযোগ প্রশিক্ষক',
          organization: 'উই ক্যান চেঞ্জ',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250'
        },
        lessons: [
          {
            title: 'ক্লাস ১: আত্মবিশ্বাসের সাথে ইংরেজি কথোপকথন শুরু করার কৌশল',
            description: 'Introduction, Ice-breaking and daily greeting practice in fluent English.',
            videoUrl: 'https://www.youtube.com/embed/juKd26qkNAw',
            duration: '৪০ মিনিট',
            order: 1
          },
          {
            title: 'ক্লাস ২: প্রফেশনাল ইমেইল ও প্রেজেন্টেশন স্কিলস',
            description: 'স্মার্টলি বিজনেস ইমেইল লেখা এবং পাবলিক স্পিকিং আর্ট।',
            videoUrl: 'https://www.youtube.com/embed/7X8II6J-6mU',
            duration: '৫০ মিনিট',
            order: 2
          }
        ],
        status: 'published',
        createdBy: adminUser?._id
      }
    ];

    for (const c of coursesToSeed) {
      await Course.create(c);
      console.log(`  ✓ Seeded course: ${c.title}`);
    }
  }

  // 3. Seed Sample Books for Book Donation Library if empty
  const existingBooks = await Book.countDocuments({});
  if (existingBooks === 0 && sampleMember) {
    console.log('[Sync] Seeding initial books in Education Wing library...');
    const booksToSeed = [
      {
        title: 'উচ্চ মাধ্যমিক পদার্থবিজ্ঞান (১ম পত্র)',
        author: 'প্রফেসর ড. শাহজাহান তপন',
        edition: '২০২৪ সংস্করণ',
        category: 'School/College Academic',
        condition: 'Like New',
        language: 'বাংলা',
        description: 'এইচএসসি বিজ্ঞান বিভাগের শিক্ষার্থীদের জন্য অত্যন্ত উপযোগী। বইটিতে কোনো দাগ নেই, একদম নতুন অবস্থা।',
        coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&q=80&w=600',
        pickupLocation: 'ঝালকাঠি সরকারি কলেজ সংলগ্ন, ঝালকাঠি',
        donor: {
          userId: sampleMember._id,
          name: sampleMember.name || 'তানভীর চৌধুরী',
          phone: sampleMember.phone || '01711234567',
          email: sampleMember.email || 'donor@wecanchange.org'
        },
        status: 'approved',
        approvedBy: adminUser?._id,
        approvedAt: new Date()
      },
      {
        title: 'প্রফেসর’স বিসিএস প্রিলিমিনারি ডাইজেস্ট',
        author: 'প্রফেসর’স প্রকাশনী',
        edition: '৪৬তম বিসিএস বিশেষ সংস্করণ',
        category: 'BCS & Competitive Exams',
        condition: 'Good',
        language: 'বাংলা',
        description: 'চাকরি প্রত্যাশী যেকোনো অসচ্ছল ভাই-বোনের জন্য উপহার। ঝালকাঠি সদর থেকে সংগ্রহ করা যাবে।',
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
        pickupLocation: 'পশ্চিম চাঁদকাঠি, ঝালকাঠি পৌরসভা',
        donor: {
          userId: sampleMember._id,
          name: sampleMember.name || 'সুমাইয়া আক্তার',
          phone: '01812987654',
          email: 'member@wecanchange.org'
        },
        status: 'approved',
        approvedBy: adminUser?._id,
        approvedAt: new Date()
      },
      {
        title: 'সবার জন্য পাইথন প্রোগ্রামিং',
        author: 'তামিম শাহরিয়ার সুবিন',
        edition: '৪র্থ মুদ্রণ',
        category: 'Science & Technology',
        condition: 'New',
        language: 'বাংলা',
        description: 'সহজ ভাষায় প্রোগ্রামিং শেখার চমৎকার বই। শিক্ষার্থীরা বিনামূল্যে রিকোয়েস্ট করতে পারেন।',
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
        pickupLocation: 'কলেজ রোড, ঝালকাঠি',
        donor: {
          userId: sampleMember._id,
          name: 'তানভীর আহমেদ',
          phone: '01711000000',
          email: 'tanvir@example.com'
        },
        status: 'pending' // One pending book donation to test Wing Leader approval!
      }
    ];

    for (const b of booksToSeed) {
      await Book.create(b);
      console.log(`  ✓ Seeded book donation: ${b.title} [Status: ${b.status}]`);
    }
  }

  console.log('[Sync] All 5 wings and Education Wing features synchronized successfully!');
};

// Auto run if executed directly
if (process.argv[1]?.endsWith('syncWingsAndEducation.js')) {
  syncWingsAndEducation().then(() => {
    console.log('[Sync Script Finished]');
    process.exit(0);
  }).catch((err) => {
    console.error('[Sync Script Failed]', err);
    process.exit(1);
  });
}
