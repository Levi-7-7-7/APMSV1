const mongoose = require('mongoose');
const Category = require('./models/Category');
require('dotenv').config();

const categories = [
  {
    name: 'NCC',
    description: 'National Cadet Corps',
    maxPoints: 50,
    subcategories: [
      { name: "Eligible for B Exam", fixedPoints: 30 },
      { name: "NCC B Certificate", fixedPoints: 10 },
      { name: "NCC C Certificate", fixedPoints: 10 },
      { name: "NIC / National Trekking / Pre-RD", fixedPoints: 10 },
      { name: "Republic Day Parade / International Youth Exchange", fixedPoints: 20 }
    ]
  },
  {
    name: 'NSS',
    description: 'National Service Scheme',
    maxPoints: 50,
    subcategories: [
      { name: 'NSS Certificate (Authenticated)', fixedPoints: 30 },
      { name: 'NSS Regional Level Camp', fixedPoints: 10 },
      { name: 'NSS State Level Camp', fixedPoints: 10 },
      { name: 'National Integration Camp / Pre-RD Camp', fixedPoints: 10 },
      { name: 'Republic Day Parade / International Youth Exchange', fixedPoints: 20 }
    ]
  },
  {
    name: 'Disaster Management',
    description: 'Social service during calamities',
    maxPoints: 20,
    subcategories: [
      { name: 'Rescue / Rehabilitation Activities (Min 40 hrs)', fixedPoints: 20 }
    ]
  },
  {
    name: 'Sports & Games',
    maxPoints: 30,
    subcategories: [
      {
        name: 'Sports Competition (Approved by Kerala Poly)',
        levels: [
          { name: 'Level I', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 5 }, { type: 'Second', points: 4 }, { type: 'Third', points: 3 }] },
          { name: 'Level II', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 5 }, { type: 'Second', points: 4 }, { type: 'Third', points: 3 }] },
          { name: 'Level III', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 6 }, { type: 'Second', points: 5 }, { type: 'Third', points: 4 }] },
          { name: 'Level IV', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 8 }, { type: 'Second', points: 6 }, { type: 'Third', points: 4 }] },
          { name: 'Level V', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 10 }, { type: 'Second', points: 8 }, { type: 'Third', points: 6 }] }
        ]
      }
    ]
  },
  {
    name: 'Cultural Activities',
    maxPoints: 30,
    subcategories: [
      {
        name: 'Arts Competition (Approved by Kerala Poly)',
        levels: [
          { name: 'Level I', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 5 }, { type: 'Second', points: 4 }, { type: 'Third', points: 3 }] },
          { name: 'Level II', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 5 }, { type: 'Second', points: 4 }, { type: 'Third', points: 3 }] },
          { name: 'Level III', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 6 }, { type: 'Second', points: 5 }, { type: 'Third', points: 4 }] },
          { name: 'Level IV', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 8 }, { type: 'Second', points: 6 }, { type: 'Third', points: 4 }] },
          { name: 'Level V', prizes: [{ type: 'Participation', points: 2 }, { type: 'First', points: 10 }, { type: 'Second', points: 8 }, { type: 'Third', points: 6 }] }
        ]
      }
    ]
  },
  {
    name: 'Professional Self Initiatives',
    subcategories: [
      { name: 'Online Courses (NPTEL/SWAYAM/etc)', fixedPoints: 30 },
      { name: 'Society Membership: Student Secretary', fixedPoints: 15 },
      { name: 'Society Membership: Committee Member', fixedPoints: 10 },
      { name: 'Society Membership: Volunteer', fixedPoints: 8 },
      { 
        name: 'Professional Body Competitions', 
        levels: [
            { name: 'Level I', prizes: [{ type: 'Participation', points: 5 }] },
            { name: 'Level II', prizes: [{ type: 'Participation', points: 8 }] },
            { name: 'Level III', prizes: [{ type: 'Participation', points: 10 }] },
            { name: 'Level IV', prizes: [{ type: 'Participation', points: 15 }] },
            { name: 'Level V', prizes: [{ type: 'Participation', points: 20 }] }
        ]
      },
      { name: 'Seminar Attendance: State Level', fixedPoints: 10 },
      { name: 'Seminar Attendance: National Level', fixedPoints: 20 },
      { name: 'Seminar Attendance: International Level', fixedPoints: 30 },
      { name: 'Paper/Poster Presentation: State', fixedPoints: 20 },
      { name: 'Paper/Poster Presentation: National', fixedPoints: 30 },
      { name: 'Paper/Poster Presentation: International', fixedPoints: 40 },
      { name: 'Coordinator of Seminar: Institution Level', fixedPoints: 5 },
      { name: 'Coordinator of Seminar: State Level', fixedPoints: 10 },
      { name: 'Coordinator of Seminar: National Level', fixedPoints: 20 },
      { name: 'Coordinator of Seminar: Committee Member', fixedPoints: 10 },
      { name: 'Industrial Visit', fixedPoints: 10 },
      { name: 'Industrial Training (Min 5 days)', fixedPoints: 20 },
      { name: 'Industrial Problem Solving', fixedPoints: 30 }
    ]
  },
  {
    name: 'Entrepreneurship and Innovation',
    subcategories: [
      { name: 'IEDC Participation (2 years)', fixedPoints: 10 },
      { name: 'Winning Competition: Institution', fixedPoints: 10 },
      { name: 'Winning Competition: State', fixedPoints: 20 },
      { name: 'Winning Competition: National', fixedPoints: 30 },
      { name: 'Winning Competition: International', fixedPoints: 40 },
      {
        name: 'Hackathon',
        levels: [
          { name: 'Regional', prizes: [{ type: 'Participation', points: 10 }, { type: 'First', points: 20 }, { type: 'Second', points: 15 }, { type: 'Third', points: 12 }] },
          { name: 'State', prizes: [{ type: 'Participation', points: 10 }, { type: 'First', points: 30 }, { type: 'Second', points: 25 }, { type: 'Third', points: 20 }] },
          { name: 'National', prizes: [{ type: 'Participation', points: 10 }, { type: 'First', points: 40 }, { type: 'Second', points: 30 }, { type: 'Third', points: 25 }] }
        ]
      },
      { name: 'Innovation Appreciation Certificate', fixedPoints: 40 },
      { name: 'Product Development Award', fixedPoints: 30 },
      { name: 'Innovative Tech Used by Industry', fixedPoints: 30 },
      { name: 'Venture Capital Funding', fixedPoints: 30 }
    ]
  },
  {
    name: 'Leadership & Management',
    subcategories: [
      { name: 'Professional Society: Core Co-ordinator', fixedPoints: 15 },
      { name: 'Professional Society: Sub Co-ordinator', fixedPoints: 10 },
      { name: 'Professional Society: Volunteer', fixedPoints: 10 },
      { name: 'College Association Chapter: Core Co-ordinator', fixedPoints: 15 },
      { name: 'College Association Chapter: Sub Co-ordinator', fixedPoints: 10 },
      { name: 'College Association Chapter: Volunteer', fixedPoints: 5 },
      { name: 'Elected Rep: Chairman (College)', fixedPoints: 20 },
      { name: 'Elected Rep: Secretary (College)', fixedPoints: 15 },
      { name: 'Elected Rep: Council Member (College)', fixedPoints: 10 },
      { name: 'Elected Rep: Class Representative', fixedPoints: 5 },
      { name: 'Elected Rep: Chairman/Gen. Secretary (Inter-Poly)', fixedPoints: 20 },
      { name: 'Elected Rep: Vice Chairman/Treasurer (Inter-Poly)', fixedPoints: 15 }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Category.deleteMany({});
    await Category.insertMany(categories);
    console.log('✅ FULL ACTIVITY POINTS TABLE SEEDED SUCCESSFULLY WITH NORMALIZED ENUMS');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();