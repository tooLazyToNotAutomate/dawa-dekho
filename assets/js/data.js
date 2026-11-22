// Demo seed data. Everything here is made up for the prototype.
import { APP } from './config.js';

export const CATS = ['bp', 'diabetes', 'fever', 'other'];

export const MEDICINES = [
  { id: 'amlodipine', name: 'Amlodipine', cat: 'bp' },
  { id: 'telmisartan', name: 'Telmisartan', cat: 'bp' },
  { id: 'losartan', name: 'Losartan', cat: 'bp' },
  { id: 'atenolol', name: 'Atenolol', cat: 'bp' },
  { id: 'metformin', name: 'Metformin', cat: 'diabetes' },
  { id: 'glimepiride', name: 'Glimepiride', cat: 'diabetes' },
  { id: 'insulin', name: 'Insulin (human)', cat: 'diabetes' },
  { id: 'paracetamol', name: 'Paracetamol', cat: 'fever' },
  { id: 'cetirizine', name: 'Cetirizine', cat: 'fever' },
  { id: 'ors', name: 'ORS sachets', cat: 'other' },
  { id: 'iron', name: 'Iron + folic acid', cat: 'other' },
  { id: 'aspirin', name: 'Aspirin', cat: 'other' },
];

const pad = (n) => String(n).padStart(2, '0');
export const dateStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function stock(map) {
  // anything not listed is in stock
  const s = {};
  for (const m of MEDICINES) s[m.id] = map[m.id] || 'in';
  return s;
}

export function makeSeed() {
  const now = Date.now();
  const min = 60 * 1000;
  const hr = 60 * min;
  const base = { password: APP.demoPassword, open: '09:00', close: '16:00', closedDays: [0], mapsLink: '' };
  const clinics = [
    {
      ...base, id: 'suncity', login: 'suncity',
      name: 'Basthi Dawakhana – Sun City', nameTe: 'బస్తీ దవాఖానా – సన్ సిటీ',
      area: 'Sun City, Bandlaguda Jagir', areaTe: 'సన్ సిటీ, బండ్లగూడ జాగీర్',
      address: 'Sun City, Bandlaguda Jagir, Hyderabad, Telangana', phone: '9000000001',
      isOpen: true, doctor: true, statusUpdatedAt: now - 18 * min, stockUpdatedAt: now - 18 * min,
      stock: stock({ amlodipine: 'low', atenolol: 'out', metformin: 'out', insulin: 'low' }),
    },
    {
      ...base, id: 'kismatpur', login: 'kismatpur',
      name: 'Basthi Dawakhana – Kismatpur', nameTe: 'బస్తీ దవాఖానా – కిస్మత్‌పూర్',
      area: 'Kismatpur, Hyderabad', areaTe: 'కిస్మత్‌పూర్, హైదరాబాద్',
      address: 'Kismatpur, Hyderabad, Telangana', phone: '9000000002',
      isOpen: true, doctor: false, statusUpdatedAt: now - 2 * hr, stockUpdatedAt: now - 2 * hr,
      stock: stock({ telmisartan: 'out', losartan: 'out', glimepiride: 'low', insulin: 'out', ors: 'low' }),
    },
    {
      ...base, id: 'moulali', login: 'moulali',
      name: 'Basthi Dawakhana – Moula Ali', nameTe: 'బస్తీ దవాఖానా – మౌలాలి',
      area: 'Moula Ali, Hyderabad', areaTe: 'మౌలాలి, హైదరాబాద్',
      address: 'Moula Ali, Hyderabad, Telangana', phone: '9000000003',
      isOpen: false, doctor: false, statusUpdatedAt: now - 27 * hr, stockUpdatedAt: now - 27 * hr,
      stock: stock({ amlodipine: 'out', telmisartan: 'low', metformin: 'low', insulin: 'out', glimepiride: 'out' }),
    },
    {
      ...base, id: 'madhuranagar', login: 'madhuranagar',
      name: 'Basthi Dawakhana – Madhuranagar Colony', nameTe: 'బస్తీ దవాఖానా – మధురానగర్ కాలనీ',
      area: 'Madhuranagar Colony, Hyderabad', areaTe: 'మధురానగర్ కాలనీ, హైదరాబాద్',
      address: 'Madhuranagar Colony, Hyderabad, Telangana', phone: '9000000004',
      isOpen: true, doctor: true, statusUpdatedAt: now - 45 * min, stockUpdatedAt: now - 45 * min,
      stock: stock({ insulin: 'low' }),
    },
  ];

  const appointments = [
    { id: 'a_seed1', clinicId: 'suncity', name: 'Ramulu K', phone: '9876500011', type: 'visit', reason: 'bp',
      date: dateStr(1), time: '10:00', status: 'pending', note: '', createdAt: now - 3 * hr },
    { id: 'a_seed2', clinicId: 'suncity', name: 'Fatima Begum', phone: '9876500012', type: 'online', reason: 'diabetes',
      date: dateStr(1), time: '11:30', status: 'pending', note: '', createdAt: now - 90 * min },
    { id: 'a_seed3', clinicId: 'suncity', name: 'Lakshmi D', phone: '9876500013', type: 'visit', reason: 'refill',
      date: dateStr(0), time: '15:00', status: 'confirmed', note: 'Please bring your old prescription.', createdAt: now - 20 * hr },
  ];

  const queries = [
    { id: 'q_seed1', clinicId: 'suncity', name: 'Fatima Begum', phone: '9876500012',
      text: 'Will insulin be available this week?', createdAt: now - 50 * min, reply: '', repliedAt: 0 },
    { id: 'q_seed2', clinicId: 'suncity', name: 'Ramulu K', phone: '9876500011',
      text: 'Is the clinic open on Saturday?', createdAt: now - 30 * hr,
      reply: 'Yes, Saturday is open from 9 AM to 4 PM.', repliedAt: now - 28 * hr },
  ];

  return { v: 1, clinics, appointments, queries };
}
