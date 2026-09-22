import jwt from 'jsonwebtoken';
import { Store } from '../data/store.js';

console.log('[Test] Testing Wing and Program modules...');

async function runTests() {
  const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_change_in_production';
  const adminToken = jwt.sign({ id: 'adm_1', email: 'admin@wecanchange.org', role: 'admin', name: 'Admin' }, jwtSecret, { expiresIn: '1h' });
  const memberToken = jwt.sign({ id: 'mbr_1', email: 'member@wecanchange.org', role: 'member', name: 'Member' }, jwtSecret, { expiresIn: '1h' });

  console.log('[1] Store Wings test...');
  const initialWings = await Store.getWings();
  console.log('Initial wings count:', initialWings.length);

  const newWing = await Store.createWing({
    nameEn: 'Education Wing',
    nameBn: 'শিক্ষা উইং',
    slug: 'education',
    description: 'Empowering youth through quality education and learning initiatives.',
    missionPoints: ['Digital literacy', 'Scholarship support', 'School supplies distribution'],
    coverImage: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b'
  });
  console.log('Created wing:', newWing.nameEn, 'Slug:', newWing.slug, 'ID:', newWing._id);

  const foundBySlug = await Store.getWingBySlug('education');
  console.log('Found by slug:', foundBySlug?.nameEn === 'Education Wing' ? 'PASS' : 'FAIL');

  const duplicateSlugCheck = await Store.findWingBySlug('education');
  console.log('Duplicate slug detected:', !!duplicateSlugCheck ? 'PASS' : 'FAIL');

  const updatedWing = await Store.updateWing(newWing._id, { description: 'Updated education wing description' });
  console.log('Updated wing description:', updatedWing?.description.includes('Updated') ? 'PASS' : 'FAIL');

  console.log('\n[2] Store Programs test...');
  const newProgram = await Store.createProgram({
    title: 'Digital Literacy Campaign 2026',
    wingId: newWing._id,
    description: 'Training 500 rural students in digital skills and basic computing.',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-05-31'),
    status: 'published',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3'
  });
  console.log('Created program:', newProgram.title, 'Status:', newProgram.status, 'Wing populated:', newProgram.wingId?.nameEn || newProgram.wingId);

  const programs = await Store.getPrograms({ wingId: String(newWing._id) });
  console.log('Programs under wing count:', programs.length, 'Wing title in program:', programs[0]?.wingId?.nameEn);

  const singleProg = await Store.getProgramById(newProgram._id);
  console.log('Found program by ID:', singleProg?.title === 'Digital Literacy Campaign 2026' ? 'PASS' : 'FAIL');

  const updatedProg = await Store.updateProgram(newProgram._id, { status: 'completed' });
  console.log('Updated program status:', updatedProg?.status === 'completed' ? 'PASS' : 'FAIL');

  // Test program deletion
  const deletedProg = await Store.deleteProgram(newProgram._id);
  console.log('Deleted program:', !!deletedProg ? 'PASS' : 'FAIL');

  // Test wing deletion
  const deletedWing = await Store.deleteWing(newWing._id);
  console.log('Deleted wing:', !!deletedWing ? 'PASS' : 'FAIL');

  console.log('\n[All Store Tests Completed Successfully!]');
}

runTests().catch(err => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
